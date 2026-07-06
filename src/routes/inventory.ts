import { Hono } from "hono";
import { z } from "zod";
import { validateJson, validationError } from "../lib/zvalidator";
import type { Env } from "../index";
import { products, inventoryMovements, lowStockAlerts } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";

const app = new Hono<Env>();

const adjustSchema = z.object({
  productId: z.number(),
  quantity: z.number(),
  notes: z.string().optional(),
  userId: z.number().optional(),
});

app.get("/stock", async (c) => {
  const db = c.get("db");
  const lowStock = c.req.query("lowStock");

  const conditions = [eq(products.isActive, 1)];
  if (lowStock === "true") {
    conditions.push(sql`current_stock <= min_stock`);
    conditions.push(sql`min_stock > 0`);
  }

  const result = await db
    .select({
      id: products.id,
      code: products.code,
      name: products.name,
      currentStock: products.currentStock,
      minStock: products.minStock,
      unit: products.unit,
    })
    .from(products)
    .where(and(...conditions))
    .orderBy(products.name)
    .all();

  return c.json({ data: result });
});

app.post("/adjust", async (c) => {
  const db = c.get("db");

  let body: z.infer<typeof adjustSchema>;
  try {
    body = await validateJson(c, adjustSchema);
  } catch (e) {
    return c.json(validationError(e), 400);
  }

  const product = await db
    .select()
    .from(products)
    .where(eq(products.id, body.productId))
    .get();

  if (!product) return c.json({ error: "Product not found" }, 404);

  await db
    .update(products)
    .set({
      currentStock: sql`current_stock + ${body.quantity}`,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(products.id, body.productId));

  const result = await db
    .insert(inventoryMovements)
    .values({
      productId: body.productId,
      type: body.quantity > 0 ? "entry" : "exit",
      quantity: Math.abs(body.quantity),
      referenceType: "adjustment",
      notes: body.notes || "Ajuste manual",
      userId: body.userId,
    })
    .returning()
    .get();

  return c.json({ data: result }, 201);
});

app.get("/movements", async (c) => {
  const db = c.get("db");
  const productId = c.req.query("productId");
  const limit = Number(c.req.query("limit") || 50);
  const offset = Number(c.req.query("offset") || 0);

  const conditions = [];
  if (productId) conditions.push(eq(inventoryMovements.productId, Number(productId)));

  const result = await db
    .select()
    .from(inventoryMovements)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`created_at DESC`)
    .limit(limit)
    .offset(offset)
    .all();

  return c.json({ data: result });
});

app.get("/alerts", async (c) => {
  const db = c.get("db");

  const alerts = await db
    .select({
      id: lowStockAlerts.id,
      productId: lowStockAlerts.productId,
      productName: products.name,
      productCode: products.code,
      currentStock: lowStockAlerts.currentStock,
      minStock: lowStockAlerts.minStock,
      resolved: lowStockAlerts.resolved,
      createdAt: lowStockAlerts.createdAt,
    })
    .from(lowStockAlerts)
    .leftJoin(products, eq(lowStockAlerts.productId, products.id))
    .where(eq(lowStockAlerts.resolved, 0))
    .orderBy(sql`created_at DESC`)
    .all();

  return c.json({ data: alerts });
});

app.post("/alerts/:id/resolve", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  await db
    .update(lowStockAlerts)
    .set({ resolved: 1 })
    .where(eq(lowStockAlerts.id, id));

  return c.json({ success: true });
});

export default app;
