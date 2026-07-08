import { Hono } from "hono";
import { z } from "zod";
import { validateJson, validationError } from "../lib/zvalidator";
import type { Env } from "../index";
import { purchaseOrders, purchaseOrderItems, products, sequences } from "../db/schema";
import { eq, desc, sql } from "drizzle-orm";

const app = new Hono<Env>();

const createOrderItemSchema = z.object({
  productId: z.number(),
  quantity: z.number().positive(),
  unitCost: z.number().min(0).default(0),
});

const createOrderSchema = z.object({
  notes: z.string().optional(),
  items: z.array(createOrderItemSchema).min(1),
});

app.get("/", async (c) => {
  const db = c.get("db");
  const result = await db
    .select({
      id: purchaseOrders.id,
      receiptNumber: purchaseOrders.receiptNumber,
      notes: purchaseOrders.notes,
      status: purchaseOrders.status,
      userId: purchaseOrders.userId,
      createdAt: purchaseOrders.createdAt,
      totalItems: sql`COALESCE((SELECT SUM(quantity) FROM purchase_order_items WHERE purchase_order_id = ${purchaseOrders.id}), 0)`.mapWith(Number),
    })
    .from(purchaseOrders)
    .orderBy(desc(purchaseOrders.createdAt))
    .all();

  return c.json(result);
});

app.get("/:id", async (c) => {
  const db = c.get("db");
  const id = parseInt(c.req.param("id"), 10);

  const order = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, id))
    .get();

  if (!order) return c.json({ error: "Order not found" }, 404);

  const items = await db
    .select({
      id: purchaseOrderItems.id,
      purchaseOrderId: purchaseOrderItems.purchaseOrderId,
      productId: purchaseOrderItems.productId,
      quantity: purchaseOrderItems.quantity,
      unitCost: purchaseOrderItems.unitCost,
      createdAt: purchaseOrderItems.createdAt,
      productName: products.name,
      productCode: products.code,
    })
    .from(purchaseOrderItems)
    .leftJoin(products, eq(products.id, purchaseOrderItems.productId))
    .where(eq(purchaseOrderItems.purchaseOrderId, id))
    .orderBy(purchaseOrderItems.id)
    .all();

  return c.json({ ...order, items });
});

app.post("/", async (c) => {
  const db = c.get("db");

  let body: z.infer<typeof createOrderSchema>;
  try {
    body = await validateJson(c, createOrderSchema);
  } catch (e) {
    return c.json(validationError(e), 400);
  }

  const seq = await db
    .update(sequences)
    .set({ value: sql`value + 1` })
    .where(eq(sequences.name, "receipt_number"))
    .returning({ value: sequences.value })
    .get();

  const seqValue = seq?.value ?? 1;
  const receiptNumber = `PO-${String(seqValue).padStart(5, "0")}`;

  const result = await db
    .insert(purchaseOrders)
    .values({ receiptNumber, notes: body.notes || null })
    .returning({ id: purchaseOrders.id })
    .get();

  if (!result) return c.json({ error: "Error creating order" }, 500);

  await db.insert(purchaseOrderItems).values(
    body.items.map((item) => ({
      purchaseOrderId: result.id,
      productId: item.productId,
      quantity: item.quantity,
      unitCost: item.unitCost,
    })),
  ).run();

  const order = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, result.id))
    .get();

  return c.json(order, 201);
});

export default app;