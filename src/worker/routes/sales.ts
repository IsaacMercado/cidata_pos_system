import { Hono } from "hono";
import { z } from "zod";
import { validateJson, validationError } from "../lib/zvalidator";
import type { Env } from "../index";
import { sales, saleItems, salePayments, products } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";

const app = new Hono<Env>();

const saleItemInput = z.object({
  productId: z.number(),
  quantity: z.number().min(0.001),
  unitPrice: z.number().min(0),
  discountPercent: z.number().min(0).max(100).default(0),
});

const createSaleSchema = z.object({
  customerId: z.number().optional(),
  userId: z.number().optional(),
  paymentMethodId: z.number().optional(),
  notes: z.string().optional(),
  tableId: z.number().optional(),
  status: z.enum(["in_progress", "completed"]).default("completed"),
  items: z.array(saleItemInput).min(1),
});

const addItemsSchema = z.object({
  items: z.array(saleItemInput).min(1),
});

const paymentInput = z.object({
  paymentMethodId: z.number(),
  amount: z.number().min(0.01),
  reference: z.string().optional(),
});

const paySchema = z.object({
  payments: z.array(paymentInput).min(1),
  customerId: z.number().optional(),
  notes: z.string().optional(),
});

async function generateReceiptNumber(d1: D1Database): Promise<string> {
  const date = new Date();
  const prefix = `REC-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

  await d1.prepare(
    "INSERT OR IGNORE INTO sequences (name, value) VALUES ('receipt_number', 1)",
  ).run();

  await d1.prepare(
    "UPDATE sequences SET value = value + 1 WHERE name = 'receipt_number'",
  ).run();

  const seq = await d1.prepare(
    "SELECT value FROM sequences WHERE name = 'receipt_number'",
  ).first<{ value: number }>();

  return `${prefix}-${String(seq!.value).padStart(5, "0")}`;
}

function buildSaleItemInsert(
  d1: D1Database,
  saleId: number,
  item: z.infer<typeof saleItemInput>,
) {
  return d1.prepare(
    `INSERT INTO sale_items (
      sale_id, product_id, quantity, unit_price, discount_percent,
      discount_amount, subtotal, tax_amount, total
    )
    WITH input AS (
      SELECT
        ? AS sale_id,
        ? AS product_id,
        ? AS quantity,
        ? AS unit_price,
        ? AS discount_percent,
        COALESCE((SELECT tax_rate FROM products WHERE id = ?), 0) AS tax_rate
    )
    SELECT
      sale_id,
      product_id,
      quantity,
      unit_price,
      discount_percent,
      ROUND(quantity * unit_price * (discount_percent / 100.0), 2),
      ROUND(quantity * unit_price - (quantity * unit_price * (discount_percent / 100.0)), 2),
      ROUND((quantity * unit_price - (quantity * unit_price * (discount_percent / 100.0))) * (tax_rate / 100.0), 2),
      ROUND(
        ROUND(quantity * unit_price - (quantity * unit_price * (discount_percent / 100.0)), 2)
        + ROUND((quantity * unit_price - (quantity * unit_price * (discount_percent / 100.0))) * (tax_rate / 100.0), 2),
        2
      )
    FROM input`,
  ).bind(
    saleId,
    item.productId,
    item.quantity,
    item.unitPrice,
    item.discountPercent,
    item.productId,
  );
}

async function getSaleDetails(db: Env["Variables"]["db"], id: number) {
  const sale = await db
    .select()
    .from(sales)
    .where(eq(sales.id, id))
    .get();

  if (!sale) return null;

  const items = await db
    .select()
    .from(saleItems)
    .leftJoin(products, eq(products.id, saleItems.productId))
    .where(eq(saleItems.saleId, id))
    .all();

  const payments = await db
    .select()
    .from(salePayments)
    .where(eq(salePayments.saleId, id))
    .all();

  return {
    ...sale,
    items: items.map(({ sale_items, products }) => ({
      ...sale_items,
      name: products?.name ?? null,
      code: products?.code ?? null,
      unit: products?.unit ?? null,
    })),
    payments,
  };
}

function asClientError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("PAYMENT_TOTAL_MISMATCH") ||
    message.includes("PAYMENT_EXCEEDS_TOTAL") ||
    message.includes("STOCK_INSUFFICIENT")
  ) {
    return { error: message.split(": ").slice(1).join(": ") || message };
  }
  return null;
}

app.post("/", async (c) => {
  const db = c.get("db");
  const d1 = c.get("env").DB;

  let body: z.infer<typeof createSaleSchema>;
  try {
    body = await validateJson(c, createSaleSchema);
  } catch (e) {
    return c.json(validationError(e), 400);
  }

  const receiptNumber = await generateReceiptNumber(d1);

  const result = await db
    .insert(sales)
    .values({
      receiptNumber,
      customerId: body.customerId,
      userId: body.userId,
      tableId: body.tableId,
      subtotal: 0,
      taxTotal: 0,
      discountTotal: 0,
      total: 0,
      paymentMethodId: body.paymentMethodId,
      notes: body.notes,
      status: body.status,
    })
    .returning()
    .get();

  try {
    await d1.batch(body.items.map((item) => buildSaleItemInsert(d1, result.id, item)));
  } catch (error) {
    const clientError = asClientError(error);
    if (clientError) return c.json({ error: clientError.error }, 400);
    throw error;
  }

  const fullSale = await getSaleDetails(db, result.id);

  return c.json({ data: fullSale }, 201);
});

app.get("/", async (c) => {
  const db = c.get("db");
  const status = c.req.query("status");
  const tableId = c.req.query("tableId");
  const limit = Number(c.req.query("limit") || 50);
  const offset = Number(c.req.query("offset") || 0);

  const conditions = [];
  if (status) conditions.push(eq(sales.status, status));
  if (tableId) conditions.push(eq(sales.tableId, Number(tableId)));

  const result = await db
    .select()
    .from(sales)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`created_at DESC`)
    .limit(limit)
    .offset(offset)
    .all();

  return c.json({ data: result });
});

app.get("/:id", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  const sale = await getSaleDetails(db, id);

  if (!sale) return c.json({ error: "Sale not found" }, 404);

  return c.json({ data: sale });
});

app.post("/:id/items", async (c) => {
  const db = c.get("db");
  const d1 = c.get("env").DB;
  const id = Number(c.req.param("id"));

  const sale = await db
    .select()
    .from(sales)
    .where(eq(sales.id, id))
    .get();

  if (!sale) return c.json({ error: "Sale not found" }, 404);
  if (sale.status !== "in_progress") return c.json({ error: "Only in-progress sales can add items" }, 400);

  let body: z.infer<typeof addItemsSchema>;
  try {
    body = await validateJson(c, addItemsSchema);
  } catch (e) {
    return c.json(validationError(e), 400);
  }

  try {
    await d1.batch(body.items.map((item) => buildSaleItemInsert(d1, id, item)));
  } catch (error) {
    const clientError = asClientError(error);
    if (clientError) return c.json({ error: clientError.error }, 400);
    throw error;
  }

  const updatedSale = await getSaleDetails(db, id);
  return c.json({ data: updatedSale });
});

app.post("/:id/pay", async (c) => {
  const db = c.get("db");
  const d1 = c.get("env").DB;
  const id = Number(c.req.param("id"));

  const sale = await db
    .select()
    .from(sales)
    .where(eq(sales.id, id))
    .get();

  if (!sale) return c.json({ error: "Sale not found" }, 404);
  if (sale.status === "completed") return c.json({ error: "Sale already completed" }, 400);
  if (sale.status === "cancelled") return c.json({ error: "Sale is cancelled" }, 400);

  let body: z.infer<typeof paySchema>;
  try {
    body = await validateJson(c, paySchema);
  } catch (e) {
    return c.json(validationError(e), 400);
  }

  const paymentValues = body.payments.map((p) => ({
    saleId: id,
    paymentMethodId: p.paymentMethodId,
    amount: Math.round(p.amount * 100) / 100,
    reference: p.reference,
  }));

  const stmts = [
    d1.prepare("DELETE FROM sale_payments WHERE sale_id = ?").bind(id),
  ];

  for (const p of paymentValues) {
    stmts.push(
      d1.prepare(
        "INSERT INTO sale_payments (sale_id, payment_method_id, amount, reference) VALUES (?, ?, ?, ?)",
      ).bind(p.saleId, p.paymentMethodId, p.amount, p.reference || null),
    );
  }

  stmts.push(
    d1.prepare(
      "UPDATE sales SET status = 'completed', customer_id = COALESCE(?, customer_id), notes = COALESCE(?, notes), payment_method_id = ? WHERE id = ?",
    ).bind(
      body.customerId ?? null,
      body.notes ?? null,
      paymentValues.length === 1 ? paymentValues[0].paymentMethodId : null,
      id,
    ),
  );

  try {
    await d1.batch(stmts);
  } catch (error) {
    const clientError = asClientError(error);
    if (clientError) return c.json({ error: clientError.error }, 400);
    throw error;
  }

  const fullSale = await getSaleDetails(db, id);

  return c.json({ data: fullSale });
});

app.post("/:id/cancel", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  const sale = await db
    .select()
    .from(sales)
    .where(eq(sales.id, id))
    .get();

  if (!sale) return c.json({ error: "Sale not found" }, 404);
  if (sale.status === "cancelled") return c.json({ error: "Sale already cancelled" }, 400);

  const result = await db
    .update(sales)
    .set({ status: "cancelled" })
    .where(eq(sales.id, id))
    .returning()
    .get();

  return c.json({ data: result });
});

export default app;
