import { and, eq, getTableColumns, like, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { catalogOverrides, exchangeRates, products, productVariants, users, variantAttributes, variantGroups } from "../db/schema";
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
const overrideSchema = z.object({
  productId: z.number().int().positive(),
  overrideType: z.enum(["price", "discount"]),
  value: z.object({ price: z.number().finite().min(0).optional(), percent: z.number().finite().min(0).max(100).optional() }),
  currency: z.string().length(3).default("USD"),
  reason: z.string().trim().min(1).max(500),
  validFrom: z.string().datetime({ offset: true }),
  validUntil: z.string().datetime({ offset: true }).optional(),
}).superRefine((body, ctx) => {
  const value = body.overrideType === "price" ? body.value.price : body.value.percent;
  if (value === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Valor requerido para el tipo de override" });
  if (body.validUntil && Date.parse(body.validUntil) <= Date.parse(body.validFrom)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["validUntil"], message: "validUntil debe ser posterior a validFrom" });
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

  const now = new Date().toISOString();
  const overrides = await db.select().from(catalogOverrides).where(eq(catalogOverrides.status, "active")).all();
  const activeByProduct = new Map(overrides
    .filter((override) => override.validFrom <= now && (!override.validUntil || override.validUntil > now))
    .map((override) => [override.productId, override]));
  return c.json({
    data: result.map((product) => {
      const override = activeByProduct.get(product.id);
      const value = override?.value as { price?: number; percent?: number } | undefined;
      const operationalPrice = override
        ? override.overrideType === "price" ? value?.price : Number((product.price * (1 - (value?.percent ?? 0) / 100)).toFixed(2))
        : product.price;
      return { ...product, officialPrice: product.price, operationalPrice, activeOverride: override ?? null };
    })
  });
});

async function currentUser(c: any, db: any): Promise<{ id: number; isSuperuser: number } | null> {
  const username = (c.get("jwtPayload") as Record<string, unknown> | undefined)?.sub;
  if (typeof username !== "string") return null;
  return await db.select({ id: users.id, isSuperuser: users.isSuperuser }).from(users).where(eq(users.username, username)).get() ?? null;
}

async function expireOverrides(db: any) {
  const now = new Date().toISOString();
  await db.update(catalogOverrides)
    .set({ status: "expired", updatedAt: sql`datetime('now')` })
    .where(and(eq(catalogOverrides.status, "active"), sql`${catalogOverrides.validUntil} IS NOT NULL AND ${catalogOverrides.validUntil} <= ${now}`))
    .run();
}

app.get("/overrides", async (c) => {
  const db = c.get("db");
  await expireOverrides(db);
  const productId = c.req.query("productId");
  const rows = await db.select()
    .from(catalogOverrides)
    .where(productId ? eq(catalogOverrides.productId, Number(productId)) : undefined)
    .orderBy(catalogOverrides.createdAt).all();
  return c.json({ data: rows });
});

app.post("/overrides", async (c) => {
  const db = c.get("db");
  const user = await currentUser(c, db);
  if (!user) return c.json({ error: "Usuario no encontrado" }, 403);
  let body: z.infer<typeof overrideSchema>;
  try { body = await validateJson(c, overrideSchema); } catch (e) { return c.json(validationError(e), 400); }
  const product = await db.select({ id: products.id }).from(products).where(eq(products.id, body.productId)).get();
  if (!product) return c.json({ error: "Product not found" }, 404);
  const result = await db.insert(catalogOverrides).values({
    ...body,
    value: body.value,
    validFrom: new Date(body.validFrom).toISOString(),
    validUntil: body.validUntil ? new Date(body.validUntil).toISOString() : null,
    createdBy: user.id,
  }).returning().get();
  return c.json({ data: result }, 201);
});

app.post("/overrides/:id/approve", async (c) => {
  const db = c.get("db");
  const user = await currentUser(c, db);
  if (!user) return c.json({ error: "Usuario no encontrado" }, 403);
  if (!user.isSuperuser) return c.json({ error: "Solo un supervisor puede aprobar overrides" }, 403);
  const id = Number(c.req.param("id"));
  const existing = await db.select().from(catalogOverrides).where(eq(catalogOverrides.id, id)).get();
  if (!existing) return c.json({ error: "Override not found" }, 404);
  if (existing.status !== "pending") return c.json({ error: "Solo se pueden aprobar overrides pendientes" }, 400);
  await db.batch([
    db.update(catalogOverrides).set({ status: "expired", updatedAt: sql`datetime('now')` }).where(and(eq(catalogOverrides.productId, existing.productId), eq(catalogOverrides.status, "active"))),
    db.update(catalogOverrides).set({ status: "active", approvedBy: user.id, updatedAt: sql`datetime('now')` }).where(eq(catalogOverrides.id, id)),
  ]);
  return c.json({ data: await db.select().from(catalogOverrides).where(eq(catalogOverrides.id, id)).get() });
});

app.post("/overrides/:id/expire", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));
  const result = await db.update(catalogOverrides).set({ status: "expired", updatedAt: sql`datetime('now')` })
    .where(and(eq(catalogOverrides.id, id), eq(catalogOverrides.status, "active"))).returning().get();
  if (!result) return c.json({ error: "Override activo no encontrado" }, 404);
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
  return c.json({ error: "Las variantes se administran en Odoo" }, 403);
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
  return c.json({ error: "Las variantes se administran en Odoo" }, 403);
  let body: z.infer<typeof attributeSchema>;
  try { body = await validateJson(c, attributeSchema); } catch (e) { return c.json(validationError(e), 400); }
  return c.json({ data: await c.get("db").insert(variantAttributes).values({ ...body, groupId: Number(c.req.param("id")) }).returning().get() }, 201);
});
app.get("/variant-groups/:id/variants", async (c) => c.json({ data: await c.get("db").select().from(productVariants).where(eq(productVariants.groupId, Number(c.req.param("id")))).all() }));
app.post("/variant-groups/:id/variants", async (c) => {
  return c.json({ error: "Las variantes se administran en Odoo" }, 403);
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
  await expireOverrides(db);
  const override = await db.select().from(catalogOverrides)
    .where(and(eq(catalogOverrides.productId, id), eq(catalogOverrides.status, "active")))
    .orderBy(catalogOverrides.createdAt).get();
  const now = new Date().toISOString();
  const activeOverride = override && override.validFrom <= now && (!override.validUntil || override.validUntil > now) ? override : null;
  const value = activeOverride?.value as { price?: number; percent?: number } | undefined;
  const operationalPrice = activeOverride
    ? activeOverride.overrideType === "price" ? value?.price : Number((product.price * (1 - (value?.percent ?? 0) / 100)).toFixed(2))
    : product.price;
  return c.json({ data: { ...product, officialPrice: product.price, operationalPrice, activeOverride } });
});

app.post("/", async (c) => {
  return c.json({ error: "El catálogo se administra en Odoo" }, 403);
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
  return c.json({ error: "El catálogo se administra en Odoo" }, 403);
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
  return c.json({ error: "El catálogo se administra en Odoo" }, 403);
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  await db
    .update(products)
    .set({ isActive: 0, catalogStatus: "inactive", updatedAt: sql`(datetime('now'))` })
    .where(eq(products.id, id));

  return c.json({ success: true });
});

export default app;
