import { Hono } from "hono";
import { z } from "zod";
import { validateJson, validationError } from "../lib/zvalidator";
import type { Env } from "../index";
import { restaurants, restaurantTables, sales } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";

const app = new Hono<Env>();

const createRestaurantSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
});

const updateRestaurantSchema = createRestaurantSchema.partial();

const createTableSchema = z.object({
  name: z.string().min(1).max(50),
  capacity: z.number().int().min(1).default(2),
  shape: z.enum(["circle", "rectangle"]).default("circle"),
  posX: z.number().default(0),
  posY: z.number().default(0),
  width: z.number().min(20).default(60),
  height: z.number().min(20).default(60),
});

const updateTableSchema = createTableSchema.partial();

// ─── Restaurants CRUD ──────────────────────────────────────────────────────

app.get("/", async (c) => {
  const db = c.get("db");
  const list = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.isActive, 1))
    .orderBy(restaurants.name)
    .all();
  return c.json({ data: list });
});

app.get("/:id", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  const restaurant = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.id, id))
    .get();

  if (!restaurant) return c.json({ error: "Restaurant not found" }, 404);

  const tables = await db
    .select()
    .from(restaurantTables)
    .where(and(
      eq(restaurantTables.restaurantId, id),
      eq(restaurantTables.isActive, 1),
    ))
    .orderBy(restaurantTables.name)
    .all();

  const tableIds = tables.map((table) => table.id);
  const openSales = tableIds.length === 0
    ? []
    : await db
      .select({
        id: sales.id,
        tableId: sales.tableId,
        receiptNumber: sales.receiptNumber,
        total: sales.total,
        createdAt: sales.createdAt,
      })
      .from(sales)
      .where(and(
        inArray(sales.tableId, tableIds),
        eq(sales.status, "in_progress"),
      ))
      .all();

  const openSaleByTable = new Map<number, (typeof openSales)[number]>();
  for (const sale of openSales) {
    if (!sale.tableId) continue;
    const current = openSaleByTable.get(sale.tableId);
    if (!current || sale.createdAt > current.createdAt) openSaleByTable.set(sale.tableId, sale);
  }

  const tablesWithSummary = tables.map((table) => {
    const openSale = openSaleByTable.get(table.id);
    return {
      ...table,
      openSaleId: openSale?.id ?? null,
      openReceiptNumber: openSale?.receiptNumber ?? null,
      openTotal: openSale?.total ?? 0,
    };
  });

  return c.json({ data: { ...restaurant, tables: tablesWithSummary } });
});

app.post("/", async (c) => {
  const db = c.get("db");

  let body: z.infer<typeof createRestaurantSchema>;
  try {
    body = await validateJson(c, createRestaurantSchema);
  } catch (e) {
    return c.json(validationError(e), 400);
  }

  const result = await db
    .insert(restaurants)
    .values(body)
    .returning()
    .get();

  return c.json({ data: result }, 201);
});

app.patch("/:id", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  let body: z.infer<typeof updateRestaurantSchema>;
  try {
    body = await validateJson(c, updateRestaurantSchema);
  } catch (e) {
    return c.json(validationError(e), 400);
  }

  const existing = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.id, id))
    .get();

  if (!existing) return c.json({ error: "Restaurant not found" }, 404);

  const result = await db
    .update(restaurants)
    .set(body)
    .where(eq(restaurants.id, id))
    .returning()
    .get();

  return c.json({ data: result });
});

app.delete("/:id", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  const existing = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.id, id))
    .get();

  if (!existing) return c.json({ error: "Restaurant not found" }, 404);

  await db
    .update(restaurants)
    .set({ isActive: 0 })
    .where(eq(restaurants.id, id));

  return c.json({ success: true });
});

// ─── Restaurant Tables ─────────────────────────────────────────────────────

app.post("/:id/tables", async (c) => {
  const db = c.get("db");
  const restaurantId = Number(c.req.param("id"));

  let body: z.infer<typeof createTableSchema>;
  try {
    body = await validateJson(c, createTableSchema);
  } catch (e) {
    return c.json(validationError(e), 400);
  }

  const restaurant = await db
    .select()
    .from(restaurants)
    .where(eq(restaurants.id, restaurantId))
    .get();

  if (!restaurant) return c.json({ error: "Restaurant not found" }, 404);

  const result = await db
    .insert(restaurantTables)
    .values({ ...body, restaurantId })
    .returning()
    .get();

  return c.json({ data: result }, 201);
});

app.patch("/:id/tables/:tableId", async (c) => {
  const db = c.get("db");
  const restaurantId = Number(c.req.param("id"));
  const tableId = Number(c.req.param("tableId"));

  let body: z.infer<typeof updateTableSchema>;
  try {
    body = await validateJson(c, updateTableSchema);
  } catch (e) {
    return c.json(validationError(e), 400);
  }

  const existing = await db
    .select()
    .from(restaurantTables)
    .where(and(
      eq(restaurantTables.id, tableId),
      eq(restaurantTables.restaurantId, restaurantId),
    ))
    .get();

  if (!existing) return c.json({ error: "Table not found" }, 404);

  const result = await db
    .update(restaurantTables)
    .set(body)
    .where(eq(restaurantTables.id, tableId))
    .returning()
    .get();

  return c.json({ data: result });
});

app.delete("/:id/tables/:tableId", async (c) => {
  const db = c.get("db");
  const tableId = Number(c.req.param("tableId"));

  const existing = await db
    .select()
    .from(restaurantTables)
    .where(eq(restaurantTables.id, tableId))
    .get();

  if (!existing) return c.json({ error: "Table not found" }, 404);

  await db
    .update(restaurantTables)
    .set({ isActive: 0 })
    .where(eq(restaurantTables.id, tableId));

  return c.json({ success: true });
});

export default app;
