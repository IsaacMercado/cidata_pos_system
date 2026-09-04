import { Hono } from "hono";
import { z } from "zod";
import { validateJson, validationError } from "../lib/zvalidator";
import type { Env } from "../index";
import { products, inventoryMovements, lowStockAlerts, recipes, recipeItems, saleItems, sales } from "../db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

const app = new Hono<Env>();

const adjustSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().finite(),
  notes: z.string().optional(),
  userId: z.number().optional(),
});

const countSchema = z.object({
  productId: z.number().int().positive(),
  countedStock: z.number().finite().min(0),
  notes: z.string().max(500).optional(),
  userId: z.number().int().positive().optional(),
});

const recipeItemSchema = z.object({
  componentProductId: z.number().int().positive(),
  quantity: z.number().finite().positive(),
});

const recipeSchema = z.object({
  productId: z.number().int().positive(),
  items: z.array(recipeItemSchema).min(1),
});

app.get("/stock", async (c) => {
  const db = c.get("db");
  const lowStock = c.req.query("lowStock");

  const conditions = [eq(products.isActive, 1)];
  if (lowStock === "true") {
    conditions.push(sql`stock_projection <= min_stock`);
    conditions.push(sql`min_stock > 0`);
  }

  const result = await db
    .select({
      id: products.id,
      code: products.code,
      name: products.name,
      currentStock: products.currentStock,
      stockProjection: products.stockProjection,
      stockOfficial: products.stockOfficial,
      minStock: products.minStock,
      unit: products.unit,
    })
    .from(products)
    .where(and(...conditions))
    .orderBy(products.name)
    .all();

  return c.json({ data: result });
});

// Current reconciliation view. The projection remains the sellable balance;
// this endpoint only reports differences against the latest Odoo snapshot.
app.get("/divergences", async (c) => {
  const db = c.get("db");
  const rows = await db.select({
    id: products.id,
    code: products.code,
    name: products.name,
    stockProjection: products.stockProjection,
    stockOfficial: products.stockOfficial,
    difference: sql<number>`stock_projection - stock_official`,
    minStock: products.minStock,
    unit: products.unit,
  }).from(products)
    .where(and(eq(products.isActive, 1), sql`stock_official IS NOT NULL AND stock_projection != stock_official`))
    .orderBy(sql`ABS(stock_projection - stock_official) DESC`)
    .all();
  return c.json({ data: rows });
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

  const result = await db.batch([
    db.update(products)
      .set({
        currentStock: sql`current_stock + ${body.quantity}`,
        updatedAt: sql`(datetime('now'))`,
      })
      .where(and(eq(products.id, body.productId), sql`current_stock + ${body.quantity} >= 0`)),
    db.insert(inventoryMovements).values({
      productId: body.productId,
      type: body.quantity > 0 ? "entry" : "exit",
      quantity: Math.abs(body.quantity),
      referenceType: "adjustment",
      notes: body.notes || "Ajuste manual",
      userId: body.userId,
    }),
  ]);

  if (!result[0].meta.changes) return c.json({ error: "STOCK_INSUFFICIENT: El inventario no puede quedar negativo" }, 409);

  const updatedProduct = await db.select().from(products).where(eq(products.id, body.productId)).get();
  return c.json({
    data: {
      ...updatedProduct,
      movement: result[1],
    },
  }, 201);
});

// Conteo físico: establece el saldo contado y registra únicamente la diferencia.
app.post("/count", async (c) => {
  const db = c.get("db");
  let body: z.infer<typeof countSchema>;
  try { body = await validateJson(c, countSchema); }
  catch (e) { return c.json(validationError(e), 400); }

  const product = await db.select().from(products).where(eq(products.id, body.productId)).get();
  if (!product) return c.json({ error: "Product not found" }, 404);
  const delta = body.countedStock - product.currentStock;
  if (Math.abs(delta) < 0.0001) return c.json({ data: { ...product, currentStock: product.currentStock, difference: 0 } });

  await db.batch([
    db.update(products).set({ currentStock: body.countedStock, updatedAt: sql`datetime('now')` }).where(eq(products.id, body.productId)),
    db.insert(inventoryMovements).values({
      productId: body.productId,
      type: "count",
      quantity: delta,
      referenceType: "physical_count",
      referenceId: body.productId,
      notes: body.notes || "Conteo físico inicial",
      userId: body.userId,
    }),
  ]);
  return c.json({ data: { ...product, currentStock: body.countedStock, difference: delta } }, 201);
});

app.get("/recipes/:productId", async (c) => {
  const db = c.get("db");
  const productId = Number(c.req.param("productId"));
  const recipe = await db.select().from(recipes).where(and(eq(recipes.productId, productId), eq(recipes.isActive, 1))).get();
  if (!recipe) return c.json({ data: null });
  const items = await db.select({ id: recipeItems.id, componentProductId: recipeItems.componentProductId, quantity: recipeItems.quantity, componentName: products.name, componentCode: products.code })
    .from(recipeItems).leftJoin(products, eq(products.id, recipeItems.componentProductId)).where(eq(recipeItems.recipeId, recipe.id)).all();
  return c.json({ data: { ...recipe, items } });
});

app.put("/recipes/:productId", async (c) => {
  const db = c.get("db");
  const productId = Number(c.req.param("productId"));
  let body: z.infer<typeof recipeSchema>;
  try { body = await validateJson(c, recipeSchema); }
  catch (e) { return c.json(validationError(e), 400); }
  if (body.productId !== productId) return c.json({ error: "Product mismatch" }, 400);
  if (body.items.some((item) => item.componentProductId === productId)) return c.json({ error: "Un producto no puede ser componente de su propia receta" }, 400);
  const [product, components] = await Promise.all([
    db.select({ id: products.id, productType: products.productType }).from(products).where(eq(products.id, productId)).get(),
    db.select({ id: products.id }).from(products).where(inArray(products.id, body.items.map((item) => item.componentProductId))).all(),
  ]);
  if (!product) return c.json({ error: "Product not found" }, 404);
  if (components.length !== new Set(body.items.map((item) => item.componentProductId)).size) return c.json({ error: "Hay componentes inexistentes" }, 400);
  const componentRows = await db.select({ id: products.id, productType: products.productType })
    .from(products).where(inArray(products.id, body.items.map((item) => item.componentProductId))).all();
  if (componentRows.some((component) => component.productType !== "simple")) {
    return c.json({ error: "Las recetas solo pueden consumir ingredientes simples" }, 400);
  }
  const existing = await db.select().from(recipes).where(eq(recipes.productId, productId)).get();
  if (existing) {
    await db.batch([
      db.delete(recipeItems).where(eq(recipeItems.recipeId, existing.id)),
      db.update(recipes).set({ isActive: 1, updatedAt: sql`datetime('now')` }).where(eq(recipes.id, existing.id)),
      db.insert(recipeItems).values(body.items.map((item) => ({ recipeId: existing.id, componentProductId: item.componentProductId, quantity: item.quantity }))),
    ]);
    return c.json({ success: true, recipeId: existing.id });
  }
  const created = await db.insert(recipes).values({ productId }).returning({ id: recipes.id }).get();
  if (!created) return c.json({ error: "Recipe not created" }, 500);
  await db.insert(recipeItems).values(body.items.map((item) => ({ recipeId: created.id, componentProductId: item.componentProductId, quantity: item.quantity }))).run();
  return c.json({ success: true, recipeId: created.id }, 201);
});

app.get("/consumption", async (c) => {
  const db = c.get("db");
  const from = c.req.query("from");
  const to = c.req.query("to");
  if (!from || !to) return c.json({ error: "from y to son requeridos (YYYY-MM-DD)" }, 400);
  const sold = await db.select({ productId: saleItems.productId, quantity: saleItems.quantity })
    .from(saleItems).innerJoin(sales, eq(sales.id, saleItems.saleId))
    .where(and(eq(sales.status, "completed"), sql`date(${sales.createdAt}) >= ${from}`, sql`date(${sales.createdAt}) <= ${to}`)).all();
  const productIds = sold.map((row) => row.productId);
  if (!productIds.length) return c.json({ data: [], from, to });
  const recipeRows = await db.select({ productId: recipes.productId, componentProductId: recipeItems.componentProductId, quantity: recipeItems.quantity, productName: products.name })
    .from(recipes).innerJoin(recipeItems, eq(recipeItems.recipeId, recipes.id)).innerJoin(products, eq(products.id, recipeItems.componentProductId))
    .where(and(eq(recipes.isActive, 1), inArray(recipes.productId, productIds))).all();
  const consumption = new Map<number, { componentName: string | null; quantity: number }>();
  for (const sale of sold) for (const recipe of recipeRows) if (recipe.productId === sale.productId) {
    const current = consumption.get(recipe.componentProductId) || { componentName: recipe.productName, quantity: 0 };
    current.quantity += sale.quantity * recipe.quantity;
    consumption.set(recipe.componentProductId, current);
  }
  return c.json({ data: [...consumption.entries()].map(([componentProductId, value]) => ({ componentProductId, ...value })), from, to });
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
    .orderBy(sql`low_stock_alerts.created_at DESC`)
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
