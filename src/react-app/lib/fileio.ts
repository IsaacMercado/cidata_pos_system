import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface SheetData {
  name: string;
  headers: string[];
  rows: string[][];
}

export interface WorkbookData {
  name: string;
  sheets: SheetData[];
}

const DECODER = new TextDecoder("utf-8");

function fileNameToSheetName(fileName: string): string {
  return fileName.replace(/\.(xlsx|xls|csv|zip)$/i, "");
}

function normalizeCell(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return String(value);
  return String(value);
}

function arrayOfArraysToSheet(name: string, data: unknown[][]): SheetData {
  const rows = data.filter((row) =>
    row.some((cell) => cell != null && String(cell).trim() !== ""),
  );
  const headers = (rows[0] ?? []).map(
    (h, i) => String(h ?? "").trim() || `Columna ${i + 1}`,
  );
  const body = rows.slice(1).map((row) => {
    const out: string[] = [];
    for (let i = 0; i < headers.length; i++) out.push(normalizeCell(row[i]));
    return out;
  });
  return { name, headers, rows: body };
}

function parseXlsxArrayBuffer(name: string, buffer: ArrayBuffer): WorkbookData {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const sheets = wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: "",
    });
    return arrayOfArraysToSheet(sheetName, aoa);
  });
  return { name, sheets };
}

export function parseCsvText(name: string, text: string): WorkbookData {
  const result = Papa.parse<unknown[]>(text, {
    skipEmptyLines: "greedy",
    transform: (v) => normalizeCell(v),
  });
  const rows = Array.isArray(result.data) ? (result.data as unknown[][]) : [];
  return {
    name,
    sheets: [arrayOfArraysToSheet(fileNameToSheetName(name), rows)],
  };
}

function parseZipArrayBuffer(name: string, buffer: ArrayBuffer): WorkbookData {
  const entries = unzipSync(new Uint8Array(buffer));
  const sheets: SheetData[] = [];
  const names = Object.keys(entries)
    .filter((n) => !n.startsWith("__MACOSX/") && !n.endsWith("/"))
    .sort();

  for (const entryName of names) {
    const bytes = entries[entryName];
    const ext = entryName.split(".").pop()?.toLowerCase();
    const sheetName = fileNameToSheetName(
      entryName.split("/").pop() ?? entryName,
    );
    if (ext === "csv") {
      sheets.push(parseCsvText(entryName, strFromU8(bytes)).sheets[0]);
    } else if (ext === "xlsx" || ext === "xls") {
      const buffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      );
      sheets.push(...parseXlsxArrayBuffer(entryName, buffer).sheets);
    } else if (ext === "json") {
      const json = strFromU8(bytes);
      try {
        const parsed: unknown = JSON.parse(json);
        if (Array.isArray(parsed)) {
          const headers =
            parsed.length > 0
              ? Object.keys(parsed[0] as Record<string, unknown>)
              : [];
          const rows = (parsed as Record<string, unknown>[]).map((row) =>
            headers.map((h) => normalizeCell(row[h])),
          );
          sheets.push({ name: sheetName, headers, rows });
        } else if (parsed && typeof parsed === "object") {
          const obj = parsed as Record<string, unknown>;
          if (Array.isArray(obj.data)) {
            const arr = obj.data as Record<string, unknown>[];
            const headers = arr.length > 0 ? Object.keys(arr[0]) : [];
            const rows = arr.map((row) =>
              headers.map((h) => normalizeCell(row[h])),
            );
            sheets.push({ name: sheetName, headers, rows });
          }
        }
      } catch {
        // JSON inválido dentro del zip: se ignora
      }
    }
  }
  return { name, sheets };
}

export function isSupportedFile(file: File): boolean {
  return /\.(xlsx|xls|csv|zip)$/i.test(file.name);
}

export async function parseFile(file: File): Promise<WorkbookData> {
  const name = file.name;
  const ext = name.split(".").pop()?.toLowerCase();

  if (ext === "xlsx" || ext === "xls") {
    return parseXlsxArrayBuffer(
      fileNameToSheetName(name),
      await file.arrayBuffer(),
    );
  }
  if (ext === "zip") {
    return parseZipArrayBuffer(
      fileNameToSheetName(name),
      await file.arrayBuffer(),
    );
  }
  if (ext === "csv") {
    return parseCsvText(name, await file.text());
  }
  throw new Error(`Tipo de archivo no soportado: ${name}`);
}

export function sheetToCsv(sheet: SheetData): string {
  return Papa.unparse([sheet.headers, ...sheet.rows]);
}

export function workbookToCsv(data: WorkbookData): string {
  return Papa.unparse([...data.sheets.flatMap((s) => [s.headers, ...s.rows])]);
}

export function sheetsToXlsxBuffer(data: WorkbookData): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const sheets =
    data.sheets.length > 0
      ? data.sheets
      : [{ name: "Hoja1", headers: [], rows: [] }];
  for (const sheet of sheets) {
    const safeName =
      sheet.name.replace(/[\\/?*[\]]/g, "_").slice(0, 31) || "Hoja";
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]),
      safeName,
    );
  }
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as
    ArrayBuffer | number[];
  return Array.isArray(out) ? (new Uint8Array(out).buffer as ArrayBuffer) : out;
}

export function sheetsToCsvZipBuffer(data: WorkbookData): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const sheets =
    data.sheets.length > 0
      ? data.sheets
      : [{ name: "Hoja1", headers: [], rows: [] }];
  for (const sheet of sheets) {
    const safeName =
      sheet.name.replace(/[\\/?*[\]]/g, "_").slice(0, 31) || "Hoja";
    files[`${safeName}.csv`] = strToU8(sheetToCsv(sheet));
  }
  return zipSync(files, { level: 6 });
}

export function unzipCsvBufferToWorkbook(
  name: string,
  buffer: ArrayBuffer,
): WorkbookData {
  return parseZipArrayBuffer(name, buffer);
}

export function decodeUtf8(bytes: Uint8Array): string {
  return DECODER.decode(bytes);
}

export function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(sheet: SheetData, fileName?: string) {
  const blob = new Blob(["\ufeff", sheetToCsv(sheet)], {
    type: "text/csv;charset=utf-8",
  });
  triggerDownload(blob, fileName ?? `${sheet.name}.csv`);
}

export function downloadXlsx(data: WorkbookData, fileName?: string) {
  const blob = new Blob([sheetsToXlsxBuffer(data)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, fileName ?? `${data.name}.xlsx`);
}

export function downloadCsvZip(data: WorkbookData, fileName?: string) {
  const blob = new Blob([new Uint8Array(sheetsToCsvZipBuffer(data))], {
    type: "application/zip",
  });
  triggerDownload(blob, fileName ?? `${data.name}.zip`);
}
