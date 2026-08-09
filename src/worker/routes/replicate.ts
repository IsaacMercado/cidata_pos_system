import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import {
  categories,
  comboItems,
  exchangeRates,
  products,
  reservations,
  restaurantTables,
  restaurants,
  saleItems,
  salePayments,
  sales,
  sequences,
  users,
} from "../db/schema";
import type { Env } from "../index";

async function getCurrentRate(
  db: any,
  currencyFrom: string,
  currencyTo: string,
): Promise<number | null> {
  if (currencyFrom === currencyTo) return 1;
  const row = await db
    .select({ rate: exchangeRates.rate })
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.currencyFrom, currencyFrom),
        eq(exchangeRates.currencyTo, currencyTo),
      ),
    )
    .orderBy(desc(exchangeRates.fetchedAt))
    .limit(1)
    .get();
  return row?.rate ?? null;
}

async function generateReceiptNumber(
  db: any,
): Promise<string> {
  const date = new Date();
  const prefix = `REC-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  await db
    .insert(sequences)
    .values({ name: "receipt_number", value: 1 })
    .onConflictDoNothing()
    .run();
  const seq = await db
    .update(sequences)
    .set({ value: sql`value + 1` })
    .where(eq(sequences.name, "receipt_number"))
    .returning({ value: sequences.value })
    .get();
  return `${prefix}-${String(seq!.value).padStart(5, "0")}`;
}

const app = new Hono<Env>();

// Pull-only replication: the client replicates reference data from the server.
// Writes still go through the existing REST API (so D1 triggers keep working).
type CollectionConfig = {
  query: (
    db: Env["Variables"]["db"],
    cpUpdated: string,
    cpId: number,
    limit: number,
  ) => Promise<any[]>;
  transform: (row: any) => any;
};

const orderByUpdated = (table: string) =>
  sql`${sql.raw(`${table}.updated_at`)} ASC, ${sql.raw(`${table}.id`)} ASC`;
const whereUpdated = (table: string, cpUpdated: string, cpId: number) =>
  sql`(${sql.raw(`${table}.updated_at`)} > ${cpUpdated}) OR (${sql.raw(`${table}.updated_at`)} = ${cpUpdated} AND ${sql.raw(`${table}.id`)} > ${cpId})`;

const COLLECTIONS: Record<string, CollectionConfig> = {
  products: {
    query: async (db, cpUpdated, cpId, limit) => {
      const rows = await db
        .select()
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(whereUpdated("products", cpUpdated, cpId))
        .orderBy(orderByUpdated("products"))
        .limit(limit)
        .all();

      const latestRateRows = await db
        .select({
          currencyTo: exchangeRates.currencyTo,
          rate: exchangeRates.rate,
          fetchedAt: exchangeRates.fetchedAt,
        })
        .from(exchangeRates)
        .where(eq(exchangeRates.currencyFrom, "USD"))
        .orderBy(desc(exchangeRates.fetchedAt))
        .all();

      const rateMap = new Map<string, { rate: number; fetchedAt: string }>();
      for (const r of latestRateRows) {
        if (!rateMap.has(r.currencyTo)) {
          rateMap.set(r.currencyTo, { rate: r.rate, fetchedAt: r.fetchedAt });
        }
      }

      // Fetch all combo_items for product enrichment
      const allComboItems = await db
        .select({
          comboProductId: comboItems.comboProductId,
          componentProductId: comboItems.componentProductId,
          quantity: comboItems.quantity,
        })
        .from(comboItems)
        .all();

      const comboByProduct = new Map<
        number,
        Array<{ componentProductId: number; quantity: number }>
      >();

      for (const ci of allComboItems) {
        const list = comboByProduct.get(ci.comboProductId) ?? [];
        list.push({
          componentProductId: ci.componentProductId,
          quantity: ci.quantity,
        });
        comboByProduct.set(ci.comboProductId, list);
      }

      return rows.map((row) => ({
        ...row,
        _rates: Array.from(rateMap.entries()).map(([code, data]) => ({
          code,
          name: code,
          rate: +(data.rate * row.products.price).toFixed(2),
          fetchedAt: data.fetchedAt,
        })),
        _comboItems: comboByProduct.get(row.products.id) ?? [],
      }));
    },
    transform: (row) => ({
      rxid: String(row.products.id),
      id: row.products.id,
      code: row.products.code,
      barcode: row.products.barcode,
      name: row.products.name,
      description: row.products.description,
      categoryId: row.products.categoryId,
      categoryName: row.categories?.name ?? null,
      price: row.products.price,
      cost: row.products.cost,
      taxRate: row.products.taxRate,
      unit: row.products.unit,
      productType: row.products.productType,
      minStock: row.products.minStock,
      currentStock: row.products.currentStock,
      isActive: row.products.isActive,
      createdAt: row.products.createdAt,
      updatedAt: row.products.updatedAt,
      rates: row._rates ?? [],
      comboItems: row._comboItems ?? [],
      _deleted: false,
    }),
  },
  restaurants: {
    query: (db, cpUpdated, cpId, limit) =>
      db
        .select()
        .from(restaurants)
        .where(whereUpdated("restaurants", cpUpdated, cpId))
        .orderBy(orderByUpdated("restaurants"))
        .limit(limit),
    transform: (row) => ({ ...row, rxid: String(row.id), _deleted: false }),
  },
  restaurant_tables: {
    query: (db, cpUpdated, cpId, limit) =>
      db
        .select()
        .from(restaurantTables)
        .where(whereUpdated("restaurant_tables", cpUpdated, cpId))
        .orderBy(orderByUpdated("restaurant_tables"))
        .limit(limit),
    transform: (row) => ({ ...row, rxid: String(row.id), _deleted: false }),
  },

  operators: {
    query: (db, cpUpdated, cpId, limit) =>
      db
        .select({
          id: users.id,
          username: users.username,
          name: users.name,
          role: users.role,
          isSuperuser: users.isSuperuser,
          pinHash: users.pinHash,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(whereUpdated("users", cpUpdated, cpId))
        .orderBy(orderByUpdated("users"))
        .limit(limit),
    transform: (row) => ({ ...row, rxid: String(row.id), _deleted: false }),
  },
};

app.post("/:collection/pull", async (c) => {
  const collection = c.req.param("collection");
  const cfg = COLLECTIONS[collection];
  if (!cfg) return c.json({ error: "Unknown collection" }, 400);

  const db = c.get("db");
  const { checkpoint, limit = 100 } = await c.req.json<{
    checkpoint: { updatedAt: string; id: number } | null;
    limit?: number;
  }>();

  const cpUpdated = checkpoint?.updatedAt ?? "";
  const cpId = checkpoint?.id ?? 0;

  const rows = await cfg.query(db, cpUpdated, cpId, limit);
  const documents = rows.map(cfg.transform);

  const last = documents[documents.length - 1];
  const newCheckpoint = last
    ? { updatedAt: last.updatedAt, id: last.id }
    : null;

  return c.json({ documents, checkpoint: newCheckpoint });
});

app.post("/:collection/push", async (c) => {
  const collection = c.req.param("collection");
  if (collection !== "sales")
    return c.json({ error: "Unknown collection" }, 400);

  const db = c.get("db");
  const body: {
    clientId: string;
    rxid: string;
    items: Array<{
      productId: number;
      quantity: number;
      unitPrice: number;
      discountPercent: number;
    }>;
    payments: Array<{
      paymentMethodId: number;
      amount: number;
      currency?: string;
      reference?: string;
      paymentDate?: string;
      phone?: string;
    }>;
    customerId?: number;
    userId?: number;
    tableId?: number;
    notes?: string;
    status?: string;
    reservations?: Array<{
      productId: number;
      checkIn: string;
      checkOut: string;
      guests: number;
      guestPrice: number;
      total: number;
    }>;
  } = await c.req.json();

  try {
    // Idempotent retry: if this offline document was already pushed, return
    // the existing sale instead of inserting a duplicate.
    if (body.clientId) {
      const existingRows = await db
        .select({
          id: sales.id,
          receiptNumber: sales.receiptNumber,
        })
        .from(sales)
        .where(eq(sales.clientId, body.clientId))
        .limit(1)
        .all();
    const existing = existingRows[0];
      if (existing) {
        return c.json({
          success: true,
          serverId: existing.id,
          receiptNumber: existing.receiptNumber,
        });
      }
    }

    const reservationsToInsert = body.reservations ?? [];
    const usdRate = await getCurrentRate(db, "USD", "VES");

    if (body.payments.some((payment) => payment.currency === "VES") && !usdRate) {
      return c.json({ error: "No hay tasa USD→VES configurada" }, 400);
    }

    // Fetch all product tax rates in one query
    const productIds = body.items.map((i) => i.productId);
    const productRows = await db
      .select({ id: products.id, taxRate: products.taxRate })
      .from(products)
      .where(inArray(products.id, productIds))
      .all();
    const taxRateMap = new Map<number, number>();
    for (const p of productRows) {
      taxRateMap.set(p.id, p.taxRate ?? 0);
    }

    const receiptNumber = await generateReceiptNumber(db);
    const saleId = sql`(SELECT id FROM sales WHERE receipt_number = ${receiptNumber})`;
    const itemValues = body.items.map((item) => {
      const taxRate = taxRateMap.get(item.productId) ?? 0;
      const baseSubtotal = item.quantity * item.unitPrice;
      const discountAmount = baseSubtotal * (item.discountPercent / 100);
      const roundedSubtotal = Math.round((baseSubtotal - discountAmount) * 100) / 100;
      const roundedDiscount = Math.round(discountAmount * 100) / 100;
      const taxAmount = Math.round((roundedSubtotal * taxRate) / 100 * 100) / 100;
      return {
        saleId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        discountAmount: roundedDiscount,
        subtotal: roundedSubtotal,
        taxAmount,
        total: roundedSubtotal + taxAmount,
      };
    });
    const paymentValues = body.payments.map((pay) => {
      const amountUsd = pay.currency === "VES"
        ? Math.round((pay.amount / (usdRate ?? 1)) * 100) / 100
        : Math.round(pay.amount * 100) / 100;
      return {
        saleId,
        paymentMethodId: pay.paymentMethodId,
        amount: amountUsd,
        currency: pay.currency ?? "USD",
        reference: pay.reference ?? null,
        paymentDate: pay.paymentDate ?? null,
        phone: pay.phone ?? null,
        amountUsd,
      };
    });
    const reservationValues = reservationsToInsert.map((reservation) => ({
      productId: reservation.productId,
      saleItemId: sql`(SELECT id FROM sale_items WHERE sale_id = ${saleId} AND product_id = ${reservation.productId} LIMIT 1)`,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      guests: reservation.guests,
      guestPrice: reservation.guestPrice,
      total: reservation.total,
    }));

    const statements = [
      db.insert(sales).values({
        receiptNumber,
        clientId: body.clientId ?? null,
        customerId: body.customerId ?? null,
        userId: body.userId ?? null,
        tableId: body.tableId ?? null,
        subtotal: 0,
        taxTotal: 0,
        discountTotal: 0,
        total: 0,
        notes: body.notes ?? null,
        status: body.status ?? "completed",
      }),
      db.insert(saleItems).values(itemValues),
      ...(paymentValues.length ? [db.insert(salePayments).values(paymentValues)] : []),
      ...(reservationValues.length ? [db.insert(reservations).values(reservationValues)] : []),
    ] as const;
    await db.batch(statements);
    const createdSale = await db.select({ id: sales.id }).from(sales).where(eq(sales.receiptNumber, receiptNumber)).get();
    if (!createdSale) return c.json({ error: "Sale was not created" }, 500);

    return c.json({
      success: true,
      serverId: createdSale.id,
      receiptNumber,
    });
  } catch (error) {
    const caught = error as { message?: unknown };
    const message = caught.message ? String(caught.message) : String(error);
    if (message.includes("UNIQUE constraint failed: sales.client_id") && body.clientId) {
      const existing = await db
        .select({ id: sales.id, receiptNumber: sales.receiptNumber })
        .from(sales)
        .where(eq(sales.clientId, body.clientId))
        .get();
      if (!existing) return c.json({ error: message }, 500);
      const { id, receiptNumber } = existing as { id: number; receiptNumber: string };
      return c.json({ success: true, serverId: id, receiptNumber });
    }
    return c.json({ error: message }, 500);
  }
});

export default app;
