import { Hono } from "hono";
import Papa from "papaparse";
import { zipSync, strToU8 } from "fflate";
import { and, asc, eq, sql } from "drizzle-orm";
import { exchangeRates, salePayments, sales } from "../db/schema";
import type { Env } from "../index";

const app = new Hono<Env>();

export interface BankRow {
  fecha: string;
  referencia: string;
  monto: number;
  concepto: string;
  tipoMovimiento: string;
  raw: Record<string, string>;
}

export interface SystemPayment {
  id: number;
  saleId: number;
  amount: number;
  amountUsd: number;
  reference: string;
  paymentDate: string | null;
  currency: string;
  phone: string | null;
  receiptNumber: string;
}

export interface ReconcileResult {
  bankCount: number;
  systemStartDate: string | null;
  excluidos: Record<string, unknown>[];
  conciliados: Record<string, unknown>[];
  faltantes: Record<string, unknown>[];
  discrepancias: Record<string, unknown>[];
  extras: Record<string, unknown>[];
  resumen: Record<string, unknown>[];
  csvs: Record<string, string>;
}

const ROW_TOLERANCE_USD = 1.0;

function pick(row: Record<string, string>, names: string[]): string {
  const lower = new Map<string, string>();
  for (const [k, v] of Object.entries(row)) lower.set(k.trim().toLowerCase(), String(v ?? "").trim());
  for (const n of names) {
    const v = lower.get(n.toLowerCase());
    if (v) return v;
  }
  return "";
}

export function normalizeDate(value: string): string {
  const v = value.trim();
  let m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return v;
}

export function parseVes(value: string): number {
  const v = String(value).trim().replace(/\s/g, "");
  if (!v) return 0;
  let normalized = v;
  if (v.includes(",") && v.includes(".")) {
    normalized = v.replace(/\./g, "").replace(",", ".");
  } else if (v.includes(",")) {
    normalized = v.replace(",", ".");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function lastDigits(value: string, count: number): string {
  return value.replace(/\D/g, "").slice(-count);
}

export function rateForDate(rateRows: { fetchedAt: string; rate: number }[], fechaISO: string): number | null {
  const dayEnd = `${fechaISO} 23:59:59`;
  let last: number | null = null;
  for (const r of rateRows) {
    if (r.fetchedAt <= dayEnd) last = r.rate;
    else break;
  }
  return last;
}

export function parseBankCsv(text: string): { rows: BankRow[]; error?: string } {
  const clean = text.replace(/^\uFEFF/, "");
  if (!clean.trim()) return { rows: [], error: "CSV vacío" };

  const parsed = Papa.parse<Record<string, string>>(clean, { header: true, skipEmptyLines: "greedy" });
  const rows = parsed.data.filter((r) =>
    Object.values(r).some((v) => v !== undefined && String(v).trim() !== ""),
  );
  if (rows.length === 0) return { rows: [], error: "CSV sin filas de datos" };

  const bank: BankRow[] = [];
  for (const row of rows) {
    const fechaRaw = pick(row, ["fecha", "date", "fechamovimiento"]);
    const refRaw = pick(row, ["referencia", "reference", "ref", "referencia_banco"]);
    const fecha = normalizeDate(fechaRaw);
    if (!fecha || !refRaw) continue;
    bank.push({
      fecha,
      referencia: refRaw,
      monto: parseVes(pick(row, ["monto", "amount", "monto_bs", "importe"])),
      concepto: pick(row, ["concepto", "descripcion", "detalle", "description"]),
      tipoMovimiento: pick(row, ["tipoMovimiento", "tipo_movimiento", "tipo", "tipoMov"]),
      raw: row,
    });
  }
  if (bank.length === 0) return { rows: [], error: "No se encontraron columnas fecha/referencia en el CSV" };
  return { rows: bank };
}

export function reconcile(
  bank: BankRow[],
  payments: SystemPayment[],
  rateRows: { fetchedAt: string; rate: number }[],
): ReconcileResult {
  const sysByKey = new Map<string, SystemPayment[]>();
  let systemStartDate: string | null = null;
  for (const p of payments) {
    const last4 = lastDigits(p.reference ?? "", 4);
    if (!last4) continue;
    const fecha = (p.paymentDate ?? "").slice(0, 10);
    if (fecha && (!systemStartDate || fecha < systemStartDate)) systemStartDate = fecha;
    const key = `${fecha}|${last4}`;
    const arr = sysByKey.get(key) ?? [];
    arr.push(p);
    sysByKey.set(key, arr);
  }

  const bankKeys = new Set<string>();
  const excluidos: Record<string, unknown>[] = [];
  const conciliados: Record<string, unknown>[] = [];
  const faltantes: Record<string, unknown>[] = [];
  const discrepancias: Record<string, unknown>[] = [];

  for (const b of bank) {
    if (systemStartDate && b.fecha < systemStartDate) {
      excluidos.push({
        fecha: b.fecha,
        referencia: b.referencia,
        monto_bs: b.monto,
        concepto: b.concepto,
        motivo: "Antes del inicio de registro de pagos en el sistema",
      });
      continue;
    }
    const last4 = lastDigits(b.referencia, 4);
    const key = `${b.fecha}|${last4}`;
    bankKeys.add(key);
    const matches = sysByKey.get(key) ?? [];
    const rate = rateForDate(rateRows, b.fecha);
    const usdEst = rate ? +(b.monto / rate).toFixed(2) : null;

    if (matches.length === 0) {
      faltantes.push({
        fecha: b.fecha,
        referencia: b.referencia,
        last4,
        monto_bs: b.monto,
        usd_estimado: usdEst ?? "",
        concepto: b.concepto,
        tipo: b.tipoMovimiento,
      });
      continue;
    }

    const totalUsd = +matches.reduce((sum, p) => sum + (p.amountUsd || 0), 0).toFixed(2);
    const diff = usdEst !== null ? Math.abs(totalUsd - usdEst) : null;

    if (diff === null || diff < ROW_TOLERANCE_USD) {
      for (const p of matches) {
        conciliados.push({
          fecha: b.fecha,
          referencia: b.referencia,
          last4,
          monto_bs: b.monto,
          usd_estimado: usdEst ?? "",
          usd_sistema: p.amountUsd,
          diff: diff !== null ? +diff.toFixed(2) : "",
          recibo: p.receiptNumber,
          sale_id: p.saleId,
          pago_id: p.id,
          ref_sistema: p.reference,
          telefono: p.phone ?? "",
        });
      }
    } else {
      discrepancias.push({
        fecha: b.fecha,
        referencia: b.referencia,
        last4,
        monto_bs: b.monto,
        usd_estimado: usdEst,
        usd_sistema: totalUsd,
        diff: +diff.toFixed(2),
        concepto: b.concepto,
        pagos_sistema: matches.length,
        recibos: matches.map((p) => p.receiptNumber).join("; "),
      });
    }
  }

  const extras: Record<string, unknown>[] = [];
  for (const [key, ps] of sysByKey) {
    if (bankKeys.has(key)) continue;
    for (const p of ps) {
      extras.push({
        fecha_sistema: (p.paymentDate ?? "").slice(0, 10),
        last4: lastDigits(p.reference, 4),
        usd_sistema: p.amountUsd,
        monto_sistema: p.amount,
        moneda: p.currency,
        recibo: p.receiptNumber,
        sale_id: p.saleId,
        pago_id: p.id,
        ref_sistema: p.reference,
        telefono: p.phone ?? "",
      });
    }
  }

  const sum = (arr: Record<string, unknown>[]) =>
    +arr
      .reduce((acc, r) => acc + (typeof r.usd_estimado === "number" ? r.usd_estimado : 0), 0)
      .toFixed(2);
  const sumUsd = (arr: Record<string, unknown>[]) =>
    +arr.reduce((acc, r) => acc + (typeof r.usd_sistema === "number" ? r.usd_sistema : 0), 0).toFixed(2);

  const resumen = [
    { metrica: "Movimientos del banco procesados", valor: bank.length },
    { metrica: "Excluidos (antes del inicio del sistema)", valor: excluidos.length },
    { metrica: "Período analizado (inicio)", valor: systemStartDate ?? "-" },
    { metrica: "Conciliados (filas)", valor: conciliados.length },
    { metrica: "Conciliados USD estimado", valor: sum(conciliados) },
    { metrica: "Conciliados USD sistema", valor: sumUsd(conciliados) },
    { metrica: "Faltantes (filas)", valor: faltantes.length },
    { metrica: "Faltantes USD estimado", valor: sum(faltantes) },
    { metrica: "Discrepancias (filas)", valor: discrepancias.length },
    { metrica: "Discrepancias USD estimado", valor: sum(discrepancias) },
    { metrica: "Pagos del sistema sin contraparte (extras)", valor: extras.length },
    { metrica: "Extras USD sistema", valor: sumUsd(extras) },
  ];

  const csv = (data: Record<string, unknown>[]) => Papa.unparse(data.length ? data : [{ mensaje: "Sin resultados" }]);
  return {
    bankCount: bank.length,
    systemStartDate,
    excluidos,
    conciliados,
    faltantes,
    discrepancias,
    extras,
    resumen,
    csvs: {
      "resumen.csv": csv(resumen),
      "excluidos.csv": csv(excluidos),
      "conciliados.csv": csv(conciliados),
      "faltantes.csv": csv(faltantes),
      "discrepancias.csv": csv(discrepancias),
      "extras.csv": csv(extras),
    },
  };
}

export function resultToZip(result: ReconcileResult): Uint8Array {
  return zipSync(
    Object.fromEntries(Object.entries(result.csvs).map(([name, csv]) => [name, strToU8(csv)])),
    { level: 6 },
  );
}

app.post("/", async (c) => {
  const db = c.get("db");
  const text = await c.req.text();
  const { rows: bank, error } = parseBankCsv(text);
  if (error) return c.json({ error }, 400);

  const [payments, rateRows] = await Promise.all([
    db
      .select({
        id: salePayments.id,
        saleId: salePayments.saleId,
        amount: salePayments.amount,
        amountUsd: salePayments.amountUsd,
        reference: salePayments.reference,
        paymentDate: salePayments.paymentDate,
        currency: salePayments.currency,
        phone: salePayments.phone,
        receiptNumber: sales.receiptNumber,
      })
      .from(salePayments)
      .innerJoin(sales, eq(salePayments.saleId, sales.id))
      .where(sql`${salePayments.reference} IS NOT NULL AND ${salePayments.reference} != ''`)
      .all(),
    db
      .select({ fetchedAt: exchangeRates.fetchedAt, rate: exchangeRates.rate })
      .from(exchangeRates)
      .where(and(eq(exchangeRates.currencyFrom, "USD"), eq(exchangeRates.currencyTo, "VES")))
      .orderBy(asc(exchangeRates.fetchedAt))
      .all(),
  ]);

  const result = reconcile(bank, payments as unknown as SystemPayment[], rateRows);
  c.header("Content-Type", "application/zip");
  c.header("Content-Disposition", 'attachment; filename="conciliacion.zip"');
  return c.body(new Uint8Array(resultToZip(result)));
});

export default app;
