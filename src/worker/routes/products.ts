import { and, eq, like, sql, getTableColumns } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { products, exchangeRates, variantGroups, variantAttributes, productVariants } from "../db/schema";
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
  taxRate: z.number().min(0).max(100).default(0),
  unit: z.string().default("unit"),
  productType: z.enum(["simple", "combo", "reservation"]).default("simple"),
  minStock: z.number().min(0).default(0),
  catalogStatus: z.enum(["active", "needs_review", "inactive"]).default("needs_review"),
  variantGroupId: z.number().optional(),
  variantAttributes: z.array(z.string()).optional(),
  variantValues: z.record(z.string()).optional(),
});

const updateSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  barcode: z.string().max(50).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  categoryId: z.number().optional(),
  price: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  unit: z.string().optional(),
  productType: z.enum(["simple", "combo", "reservation"]).optional(),
  minStock: z.number().min(0).optional(),
  catalogStatus: z.enum(["active", "needs_review", "inactive"]).optional(),
  isActive: z.union([z.literal(0), z.literal(1)]).optional(),
  variantGroupId: z.number().nullable().optional(),
  variantAttributes: z.array(z.string()).optional(),
  variantValues: z.record(z.string()).optional(),
});

const groupSchema = z.object({ productId: z.number(), name: z.string().min(1).max(100), attributes: z.array(z.string()).default([]) });
const attributeSchema = z.object({ name: z.string().min(1).max(100), position: z.number().int().min(0).default(0) });
const variantSchema = z.object({ productId: z.number(), values: z.record(z.string()).default({}) });

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

  return c.json({ data: result });
});

app.get("/variant-groups", async (c) => {
  const db = c.get("db");
  const groups = await db.select().from(variantGroups).all();
  const attrs = await db.select().from(variantAttributes).all();
  const variants = await db.select().from(productVariants).all();
  return c.json({ data: groups.map((group) => ({ ...group, attributes: attrs.filter((a) => a.groupId === group.id), variants: variants.filter((v) => v.groupId === group.id) })) });
});

app.post("/variant-groups", async (c) => {
  const db = c.get("db");
  let body: z.infer<typeof groupSchema>;
  try { body = await validateJson(c, groupSchema); } catch (e) { return c.json(validationError(e), 400); }
  const group = await db.insert(variantGroups).values({ productId: body.productId, name: body.name }).returning().get();
  await db.update(products).set({ variantGroupId: group.id }).where(eq(products.id, body.productId));
  for (const [position, name] of body.attributes.entries()) await db.insert(variantAttributes).values({ groupId: group.id, name, position }).onConflictDoNothing().run();
  return c.json({ data: group }, 201);
});

app.get("/variant-groups/:id/attributes", async (c) => c.json({ data: await c.get("db").select().from(variantAttributes).where(eq(variantAttributes.groupId, Number(c.req.param("id")))).all() }));
app.post("/variant-groups/:id/attributes", async (c) => {
  let body: z.infer<typeof attributeSchema>;
  try { body = await validateJson(c, attributeSchema); } catch (e) { return c.json(validationError(e), 400); }
  return c.json({ data: await c.get("db").insert(variantAttributes).values({ ...body, groupId: Number(c.req.param("id")) }).returning().get() }, 201);
});
app.get("/variant-groups/:id/variants", async (c) => c.json({ data: await c.get("db").select().from(productVariants).where(eq(productVariants.groupId, Number(c.req.param("id")))).all() }));
app.post("/variant-groups/:id/variants", async (c) => {
  let body: z.infer<typeof variantSchema>;
  try { body = await validateJson(c, variantSchema); } catch (e) { return c.json(validationError(e), 400); }
  const groupId = Number(c.req.param("id"));
  await dbUpdateVariant(c.get("db"), groupId, body.productId, body.values);
  return c.json({ data: await c.get("db").select().from(productVariants).where(eq(productVariants.productId, body.productId)).get() }, 201);
});

async function dbUpdateVariant(db: any, groupId: number, productId: number, values: Record<string, string>) {
  await db.insert(productVariants).values({ groupId, productId, valuesJson: values }).onConflictDoUpdate({ target: productVariants.productId, set: { groupId, valuesJson: values, updatedAt: sql`(datetime('now'))` } }).run();
  await db.update(products).set({ variantGroupId: groupId, variantValues: values }).where(eq(products.id, productId));
}

app.get("/:id", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));
  const product = await db.select().from(products).where(eq(products.id, id)).get();
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

  const catalogChanges = body;
  const result = await db
    .update(products)
    .set(catalogChanges)
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
    .set({ isActive: 0, catalogStatus: "inactive", updatedAt: sql`(datetime('now'))` })
    .where(eq(products.id, id));

  return c.json({ success: true });
});

export default app;
