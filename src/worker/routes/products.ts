import { and, eq, like, sql, getTableColumns, name } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { products, exchangeRates } from "../db/schema";
import type { Env } from "../index";
import { validateJson, validationError } from "../lib/zvalidator";

const app = new Hono<Env>();

const createSchema = z.object({
  code: z.string().min(1).max(50),
  barcode: z.string().max(50).optional(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  categoryId: z.number().optional(),
  price: z.number().min(0).default(0),
  cost: z.number().min(0).default(0),
  taxRate: z.number().min(0).default(0),
  unit: z.string().default("unit"),
  productType: z.enum(["simple", "combo", "reservation"]).default("simple"),
  minStock: z.number().min(0).default(0),
  currentStock: z.number().min(0).default(0),
});

const updateSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  barcode: z.string().max(50).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  categoryId: z.number().optional(),
  price: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  taxRate: z.number().min(0).optional(),
  unit: z.string().optional(),
  productType: z.enum(["simple", "combo", "reservation"]).optional(),
  minStock: z.number().min(0).optional(),
  currentStock: z.number().min(0).optional(),
  isActive: z.number().min(0).max(1).optional(),
});

interface ExchangeRate {
  name: string;
  rate: number;
  fetchedAt: string;
}

app.get("/", async (c) => {
  const db = c.get("db");
  const search = c.req.query("search");
  const categoryId = c.req.query("categoryId");
  const active = c.req.query("active");

  const conditions = [];
  if (search) conditions.push(like(products.name, `%${search}%`));
  if (categoryId) conditions.push(eq(products.categoryId, Number(categoryId)));
  if (active !== undefined) conditions.push(eq(products.isActive, Number(active)));

  const subQuery = db
      .select({
        id: exchangeRates.id,
        currencyTo: exchangeRates.currencyTo,
        rate: exchangeRates.rate,
        fetchedAt: exchangeRates.fetchedAt,
        rowNum: sql<number>`ROW_NUMBER() OVER (
          PARTITION BY ${exchangeRates.currencyFrom}
          ORDER BY ${exchangeRates.fetchedAt} DESC
        )`.as('row_num'),
      })
      .from(exchangeRates)
      .where(eq(exchangeRates.currencyFrom, 'USD'))
      .as('er');

  const result = await db
    .select({
      ...getTableColumns(products),
      rates: sql<ExchangeRate[] | null>`(
          SELECT json_group_array(
            json_object(
              'id', ${subQuery.id},
              'name', ${subQuery.currencyTo},
              'rate', ${subQuery.rate} * ${products.price},
              'fetchedAt', ${subQuery.fetchedAt}
            )
          )
          FROM ${subQuery}
          WHERE ${subQuery.rowNum} = 1
        )`.mapWith(JSON.parse),
    })
    .from(products)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(products.name)
    .all();

  result.map((r) => console.log(r.rates));

  return c.json({ data: result });
});

app.get("/:id", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  const product = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .get();

  if (!product) return c.json({ error: "Product not found" }, 404);
  return c.json({ data: product });
});

app.post("/", async (c) => {
  const db = c.get("db");

  let body: z.infer<typeof createSchema>;
  try {
    body = await validateJson(c, createSchema);
  } catch (e) {
    return c.json(validationError(e), 400);
  }

  const existing = await db
    .select()
    .from(products)
    .where(eq(products.code, body.code))
    .get();

  if (existing) return c.json({ error: "Product code already exists" }, 409);

  const result = await db
    .insert(products)
    .values(body)
    .returning()
    .get();

  return c.json({ data: result }, 201);
});

app.patch("/:id", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  let body: z.infer<typeof updateSchema>;
  try {
    body = await validateJson(c, updateSchema);
  } catch (e) {
    return c.json(validationError(e), 400);
  }

  const existing = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .get();

  if (!existing) return c.json({ error: "Product not found" }, 404);

  const result = await db
    .update(products)
    .set(body)
    .where(eq(products.id, id))
    .returning()
    .get();

  return c.json({ data: result });
});

app.delete("/:id", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  await db
    .update(products)
    .set({ isActive: 0, updatedAt: sql`(datetime('now'))` })
    .where(eq(products.id, id));

  return c.json({ success: true });
});

export default app;
