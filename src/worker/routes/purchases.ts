import { Hono } from "hono";
import { z } from "zod";
import { validateJson, validationError } from "../lib/zvalidator";
import type { Env } from "../index";

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
  const { DB } = c.env;

  const rows = await DB.prepare(
    `SELECT po.id, po.receipt_number, po.notes, po.status, po.user_id, po.created_at,
            (SELECT COALESCE(SUM(quantity), 0) FROM purchase_order_items WHERE purchase_order_id = po.id) as total_items
     FROM purchase_orders po
     ORDER BY po.created_at DESC`,
  ).all();

  return c.json(rows.results);
});

app.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const { DB } = c.env;

  const order = await DB.prepare(
    "SELECT * FROM purchase_orders WHERE id = ?",
  ).bind(id).first() as any;

  if (!order) return c.json({ error: "Orden no encontrada" }, 404);

  const items = await DB.prepare(
    `SELECT poi.*, p.name as product_name, p.code as product_code
     FROM purchase_order_items poi
     JOIN products p ON p.id = poi.product_id
     WHERE poi.purchase_order_id = ?
     ORDER BY poi.id`,
  ).bind(id).all();

  return c.json({ ...order, items: items.results });
});

app.post("/", async (c) => {
  const { DB } = c.env;

  let body: z.infer<typeof createOrderSchema>;
  try {
    body = await validateJson(c, createOrderSchema);
  } catch (e) {
    return c.json(validationError(e), 400);
  }

  const seq = await DB.prepare(
    "UPDATE sequences SET value = value + 1 WHERE name = 'receipt_number' RETURNING value",
  ).first() as { value: number } | null;

  const seqValue = seq?.value ?? 1;
  const receiptNumber = `PO-${String(seqValue).padStart(5, "0")}`;

  const result = await DB.prepare(
    "INSERT INTO purchase_orders (receipt_number, notes) VALUES (?, ?) RETURNING id",
  ).bind(receiptNumber, body.notes || null).first() as { id: number } | null;

  if (!result) return c.json({ error: "Error creating order" }, 500);

  const orderId = result.id;
  const stmt = DB.prepare(
    "INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_cost) VALUES (?, ?, ?, ?)",
  );

  for (const item of body.items) {
    await stmt.bind(orderId, item.productId, item.quantity, item.unitCost).run();
  }

  const order = await DB.prepare("SELECT * FROM purchase_orders WHERE id = ?")
    .bind(orderId).first();

  return c.json(order, 201);
});

export default app;