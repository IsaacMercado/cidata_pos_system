import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import type { Context, Next } from "hono";
import { Hono } from "hono";
import { sign, verify } from "hono/jwt";
import { z } from "zod";
import {
  catalogChangeLog,
  categories,
  comboItems,
  exchangeRates,
  integrationOperations,
  paymentMethods,
  products,
  reservationRates,
  restaurants,
  restaurantTables,
  sales,
} from "../db/schema";
import type { Env } from "../index";
import { buildSalePayload } from "../lib/integration";

const app = new Hono<Env>();

// ─── Auth por token de integración (Odoo -> Worker, saliente) ───────────────
const INTEGRATION_TOKEN_TTL = 60 * 60; // 1 hora

function integrationToken(c: { env: Env["Bindings"] }): string | undefined {
  return c.env.INTEGRATION_TOKEN;
}

async function requireIntegrationAuth(c: Context<Env>, next: Next) {
  const tokenSecret = integrationToken(c);
  if (!tokenSecret) {
    return c.json({ error: "Integration not configured" }, 503);
  }

  const header = c.req.header("Authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!bearer) {
    return c.json({ error: "Missing integration token" }, 401);
  }

  // El endpoint /auth valida el token estático y emite un JWT de corta vida.
  // Los demás endpoints aceptan tanto el token estático como el JWT emitido.
  if (new URL(c.req.url).pathname.endsWith("/api/integration/auth")) {
    if (bearer !== tokenSecret) {
      return c.json({ error: "Invalid integration token" }, 401);
    }
    c.set("integrationAuth", { kind: "static" });
    return next();
  }

  if (bearer === tokenSecret) {
    c.set("integrationAuth", { kind: "static" });
    return next();
  }

  try {
    const payload = await verify(bearer, tokenSecret, "HS256");
    if (payload.scope !== "odoo_integration") throw new Error("bad scope");
    c.set("integrationAuth", { kind: "jwt", sub: payload.sub });
    return next();
  } catch {
    return c.json({ error: "Invalid or expired integration token" }, 401);
  }
}

app.use("*", requireIntegrationAuth);

// POST /api/integration/auth
app.post("/auth", async (c) => {
  const now = Math.floor(Date.now() / 1000);
  const jwt = await sign(
    {
      sub: "odoo_adapter",
      scope: "odoo_integration",
      iat: now,
      exp: now + INTEGRATION_TOKEN_TTL,
    },
    integrationToken(c)!,
    "HS256",
  );
  return c.json({
    token_type: "Bearer",
    access_token: jwt,
    expires_in: INTEGRATION_TOKEN_TTL,
  });
});

// GET /api/integration/sync-status
app.get("/sync-status", async (c) => {
  const db = c.get("db");
  const counts = await db
    .select({ status: integrationOperations.status, count: sql<number>`count(*)` })
    .from(integrationOperations)
    .groupBy(integrationOperations.status)
    .all();

  const lastProcessed = await db
    .select({ processedAt: integrationOperations.processedAt })
    .from(integrationOperations)
    .where(eq(integrationOperations.status, "accepted"))
    .orderBy(sql`processed_at desc`)
    .limit(1)
    .get();

  const rate = await db
    .select()
    .from(exchangeRates)
    .orderBy(sql`fetched_at desc`)
    .limit(1)
    .get();

  return c.json({
    operations: Object.fromEntries(counts.map((row) => [row.status, row.count])),
    last_accepted_at: lastProcessed?.processedAt ?? null,
    latest_exchange_rate_usd_ves: rate?.rate ?? null,
    server_time: new Date().toISOString(),
  });
});

// GET /api/integration/catalog/changes?since=<iso>
app.get("/catalog/changes", async (c) => {
  const db = c.get("db");
  const since = c.req.query("since");

  const sinceCondition = since ? gt(products.updatedAt, since) : undefined;

  const productRows = await db
    .select({
      id: products.id,
      code: products.code,
      barcode: products.barcode,
      name: products.name,
      description: products.description,
      category_id: products.categoryId,
      price: products.price,
      cost: products.cost,
      tax_rate: products.taxRate,
      unit: products.unit,
      product_type: products.productType,
      catalog_status: products.catalogStatus,
      min_stock: products.minStock,
      current_stock: products.currentStock,
      is_active: products.isActive,
      updated_at: products.updatedAt,
      variant_group_id: products.variantGroupId,
      variant_attributes: products.variantAttributes,
      variant_values: products.variantValues,
    })
    .from(products)
    .where(sinceCondition)
    .orderBy(asc(products.updatedAt))
    .limit(500)
    .all();

  const catSince = since ? gt(categories.updatedAt, since) : undefined;
  const categoryRows = await db
    .select()
    .from(categories)
    .where(catSince)
    .orderBy(asc(categories.updatedAt))
    .limit(500)
    .all();

  const productIds = productRows.filter((p) => p.product_type === "combo").map((p) => p.id);
  const comboRows = productIds.length
    ? await db
      .select({
        comboProductId: comboItems.comboProductId,
        componentCloudflareId: comboItems.componentProductId,
        quantity: comboItems.quantity,
        componentCode: products.code,
        componentName: products.name,
      })
      .from(comboItems)
      .innerJoin(products, eq(products.id, comboItems.componentProductId))
      .where(inArray(comboItems.comboProductId, productIds))
      .all()
    : [];

  const methodRows = await db.select().from(paymentMethods).all();

  const restaurantRows = await db.select().from(restaurants).all();
  const tableRows = await db.select().from(restaurantTables).all();
  const rateRows = await db
    .select({
      productId: reservationRates.productId,
      productCode: products.code,
      guests: reservationRates.guests,
      price: reservationRates.price,
    })
    .from(reservationRates)
    .innerJoin(products, eq(products.id, reservationRates.productId))
    .all();

  const timestamps = [
    ...productRows.map((p) => p.updated_at),
    ...categoryRows.map((cat) => cat.updatedAt),
  ].filter(Boolean);
  const cursor = timestamps.length > 0 ? timestamps.sort().at(-1) : since ?? null;

  return c.json({
    cursor,
    categories: categoryRows.map((cat) => ({
      cloudflare_id: cat.id,
      name: cat.name,
      parent_cloudflare_id: cat.parentId,
      is_active: !!cat.isActive,
      external_id: `cf_category_${cat.id}`,
    })),
    products: productRows.map((p) => ({
      cloudflare_id: p.id,
      external_id: p.code,
      code: p.code,
      barcode: p.barcode,
      name: p.name,
      description: p.description,
      category_cloudflare_id: p.category_id,
      price: p.price,
      cost: p.cost,
      tax_rate_percent: p.tax_rate,
      unit: p.unit,
      product_type: p.product_type,
      catalog_status: p.catalog_status,
      min_stock: p.min_stock,
      current_stock_operational: p.current_stock,
      is_active: !!p.is_active,
      updated_at: p.updated_at,
      combo_items:
        p.product_type === "combo"
          ? comboRows
            .filter((ci) => ci.comboProductId === p.id)
            .map((ci) => ({
              component_cloudflare_id: ci.componentCloudflareId,
              component_external_id: ci.componentCode,
              component_name: ci.componentName,
              quantity: ci.quantity,
            }))
          : [],
      variant_group_id: p.variant_group_id,
      variant_attributes: p.variant_attributes ?? [],
      variant_values: p.variant_values ?? {},
    })),
    payment_methods: methodRows.map((m) => ({
      cloudflare_id: m.id,
      code: m.code,
      name: m.name,
      is_active: !!m.isActive,
    })),
    restaurants: restaurantRows.map((r) => ({
      cloudflare_id: r.id,
      name: r.name,
      is_active: !!r.isActive,
    })),
    tables: tableRows.map((t) => ({
      cloudflare_id: t.id,
      restaurant_cloudflare_id: t.restaurantId,
      name: t.name,
      capacity: t.capacity,
      status: t.status,
      is_active: !!t.isActive,
    })),
    reservation_rates: rateRows.map((r) => ({
      product_code: r.productCode,
      product_id: r.productId,
      guests: r.guests,
      price: r.price,
    })),
  });
});

// GET /api/integration/operations/pending?limit=50
const MAX_BATCH = 100;
const STALE_PROCESSING_MINUTES = 15;
const MAX_ATTEMPTS = 8;

function sqliteNow(minutesAgo = 0): string {
  return new Date(Date.now() - minutesAgo * 60_000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
}

app.get("/operations/pending", async (c) => {
  const db = c.get("db");
  const limit = Math.min(Number(c.req.query("limit") || 20), MAX_BATCH);

  // Recupera operaciones atascadas en 'processing' (crash de red a mitad del lote).
  await db
    .update(integrationOperations)
    .set({ status: "pending", leaseToken: null, leaseUntil: null, updatedAt: sql`datetime('now')` })
    .where(
      and(
        eq(integrationOperations.status, "processing"),
        sql`(${integrationOperations.leaseUntil} IS NULL AND ${integrationOperations.processingStartedAt} < ${sqliteNow(STALE_PROCESSING_MINUTES)}) OR ${integrationOperations.leaseUntil} < datetime('now')`,
      ),
    )
    .run();

  const candidates = await db
    .select({ operationId: integrationOperations.operationId })
    .from(integrationOperations)
    .where(and(eq(integrationOperations.status, "pending"), sql`(${integrationOperations.nextAttemptAt} IS NULL OR ${integrationOperations.nextAttemptAt} <= datetime('now'))`))
    .orderBy(asc(integrationOperations.createdAt))
    .limit(limit)
    .all();

  const leaseToken = candidates.length ? crypto.randomUUID() : null;
  const leaseUntil = new Date(Date.now() + STALE_PROCESSING_MINUTES * 60_000).toISOString().replace("T", " ").slice(0, 19);
  if (leaseToken) {
    // The conditional UPDATE is the claim. A competing consumer can select the
    // same candidates, but only one of them can transition each row.
    await db.update(integrationOperations).set({ status: "processing", leaseToken, leaseUntil, processingStartedAt: sql`datetime('now')`, attemptCount: sql`attempt_count + 1`, updatedAt: sql`datetime('now')` })
      .where(and(inArray(integrationOperations.operationId, candidates.map((candidate) => candidate.operationId)), eq(integrationOperations.status, "pending"), sql`(${integrationOperations.nextAttemptAt} IS NULL OR ${integrationOperations.nextAttemptAt} <= datetime('now'))`)).run();
  }
  const batch = leaseToken ? await db.select().from(integrationOperations).where(and(eq(integrationOperations.leaseToken, leaseToken), eq(integrationOperations.status, "processing"))).all() : [];

  const operations = await Promise.all(batch.map(async (op) => {
    let payload: unknown = JSON.parse(op.payload);
    if (payload && typeof payload === "object" && Object.keys(payload).length === 0 && op.entityType === "sale") {
      const sale = await db.select({ id: sales.id }).from(sales).where(eq(sales.clientId, op.entityId)).get()
        ?? await db.select({ id: sales.id }).from(sales).where(eq(sales.receiptNumber, op.entityId)).get();
      if (sale) payload = await buildSalePayload(db, sale.id) ?? payload;
    }
    return { op, payload };
  }));

  return c.json({
    operations: operations.map(({ op, payload }) => ({
      operation_id: op.operationId,
      installation_id: op.installationId,
      entity_type: op.entityType,
      entity_id: op.entityId,
      payload,
      created_at: op.createdAt,
      attempt_count: op.attemptCount,
      lease_token: op.leaseToken,
    })),
  });
});

// POST /api/integration/operations/ack  (idempotente)
const ackSchema = z.object({
  results: z.array(z.object({
    operation_id: z.string(),
    lease_token: z.string(),
    odoo_refs: z.record(z.union([z.string(), z.number(), z.null()])).optional(),
  })).min(1),
});

app.post("/operations/ack", async (c) => {
  const db = c.get("db");
  let body: z.infer<typeof ackSchema>;
  try {
    body = ackSchema.parse(await c.req.json());
  } catch (e) {
    return c.json({ error: "Invalid body", details: String(e) }, 400);
  }

  let accepted = 0;
  let alreadyAccepted = 0;
  for (const result of body.results) {
    const existing = await db
      .select({ status: integrationOperations.status })
      .from(integrationOperations)
      .where(eq(integrationOperations.operationId, result.operation_id))
      .get();

    if (!existing) continue;
    if (existing.status === "accepted") {
      alreadyAccepted += 1;
      continue;
    }

    await db
      .update(integrationOperations)
      .set({
        status: "accepted",
        processedAt: sql`datetime('now')`,
        updatedAt: sql`datetime('now')`,
        lastError: null,
      })
      .where(and(eq(integrationOperations.operationId, result.operation_id), eq(integrationOperations.status, "processing"), eq(integrationOperations.leaseToken, result.lease_token)));
    accepted += 1;
  }

  return c.json({ accepted, already_accepted: alreadyAccepted });
});

// POST /api/integration/operations/fail
const failSchema = z.object({
  results: z.array(z.object({
    operation_id: z.string(),
    lease_token: z.string(),
    error: z.string(),
    // functional: detener y mostrar en Odoo (rejected). permanent: dead_letter.
    // retryable: volver a pending para reintento con backoff.
    classification: z.enum(["retryable", "functional", "permanent"]),
  })).min(1),
});

app.post("/operations/fail", async (c) => {
  const db = c.get("db");
  let body: z.infer<typeof failSchema>;
  try {
    body = failSchema.parse(await c.req.json());
  } catch (e) {
    return c.json({ error: "Invalid body", details: String(e) }, 400);
  }

  let retried = 0;
  let rejected = 0;
  let deadLettered = 0;
  for (const result of body.results) {
    const statusByClass: Record<string, string> = {
      retryable: "pending",
      functional: "rejected",
      permanent: "dead_letter",
    };
    const current = await db.select({ attemptCount: integrationOperations.attemptCount, status: integrationOperations.status }).from(integrationOperations).where(eq(integrationOperations.operationId, result.operation_id)).get();
    const nextStatus = result.classification === "retryable" && (current?.attemptCount ?? MAX_ATTEMPTS) >= MAX_ATTEMPTS ? "dead_letter" : statusByClass[result.classification];

    const update = db
      .update(integrationOperations)
      .set({
        status: nextStatus,
        lastError: result.error.slice(0, 2000),
        errorClass: result.classification,
        updatedAt: sql`datetime('now')`,
        leaseToken: null,
        leaseUntil: null,
        nextAttemptAt: nextStatus === "pending" ? sql`datetime('now', '+' || MIN(POWER(2, attempt_count), 3600) || ' seconds')` : null,
      })
      .where(and(eq(integrationOperations.operationId, result.operation_id), eq(integrationOperations.status, "processing"), eq(integrationOperations.leaseToken, result.lease_token)))
      .run();
    await update;

    if (nextStatus === "pending") retried += 1;
    else if (nextStatus === "rejected") rejected += 1;
    else deadLettered += 1;
  }

  return c.json({ retried, rejected, dead_lettered: deadLettered });
});

// POST /api/integration/catalog/publish  (Odoo -> POS, Fase 4)
const publishSchema = z.object({
  changes: z.array(z.object({
    change_id: z.string(),
    entity_type: z.enum(["product", "category"]),
    action: z.enum(["upsert", "deactivate"]),
    external_ref: z.string(),
    data: z.record(z.any()),
  })).min(1),
});

app.post("/catalog/publish", async (c) => {
  const db = c.get("db");

  let body: z.infer<typeof publishSchema>;
  try {
    body = publishSchema.parse(await c.req.json());
  } catch (e) {
    return c.json({ error: "Invalid body", details: String(e) }, 400);
  }

  const results: Array<{ change_id: string; result: string }> = [];

  for (const change of body.changes) {
    try {
      if (change.entity_type === "product") {
        const data = change.data as Record<string, unknown>;
        const existing = await db
          .select({ id: products.id })
          .from(products)
          .where(eq(products.code, change.external_ref))
          .get();

        const values: Record<string, unknown> = {
          name: typeof data.name === "string" ? data.name : undefined,
          price: typeof data.price === "number" ? data.price : undefined,
          cost: typeof data.cost === "number" ? data.cost : undefined,
          barcode: typeof data.barcode === "string" ? data.barcode : undefined,
          description: typeof data.description === "string" ? data.description : undefined,
          taxRate: typeof data.tax_rate_percent === "number" ? data.tax_rate_percent : undefined,
          unit: typeof data.unit === "string" ? data.unit : undefined,
          productType: typeof data.product_type === "string" ? data.product_type : undefined,
          catalogStatus: typeof data.catalog_status === "string" ? data.catalog_status : undefined,
          minStock: typeof data.min_stock === "number" ? data.min_stock : undefined,
          // Fase 7: ajustes de inventario oficial (Odoo -> POS).
          currentStock: typeof data.current_stock === "number" ? data.current_stock : undefined,
          isActive: change.action === "deactivate" ? 0 : typeof data.is_active === "boolean" ? (data.is_active ? 1 : 0) : undefined,
          variantAttributes: Array.isArray(data.variant_attributes) ? data.variant_attributes : undefined,
          variantValues: data.variant_values && typeof data.variant_values === "object" ? data.variant_values : undefined,
          updatedAt: sql`datetime('now')`,
        };
        for (const key of Object.keys(values)) {
          if (values[key] === undefined) delete values[key];
        }

        if (existing) {
          await db.update(products).set(values).where(eq(products.id, existing.id)).run();
        } else if (change.action === "upsert") {
          await db
            .insert(products)
            .values({
              code: change.external_ref,
              name: typeof data.name === "string" ? data.name : change.external_ref,
              price: typeof data.price === "number" ? data.price : 0,
              cost: typeof data.cost === "number" ? data.cost : 0,
              barcode: typeof data.barcode === "string" ? data.barcode : null,
              description: typeof data.description === "string" ? data.description : null,
              taxRate: typeof data.tax_rate_percent === "number" ? data.tax_rate_percent : 0,
              unit: typeof data.unit === "string" ? data.unit : "unit",
              productType: typeof data.product_type === "string" ? data.product_type : "simple",
              catalogStatus: typeof data.catalog_status === "string" ? data.catalog_status : "active",
              minStock: typeof data.min_stock === "number" ? data.min_stock : 0,
              currentStock: typeof data.current_stock === "number" ? data.current_stock : 0,
              isActive: typeof data.is_active === "boolean" ? (data.is_active ? 1 : 0) : 1,
              variantAttributes: Array.isArray(data.variant_attributes) ? data.variant_attributes : [],
              variantValues: data.variant_values && typeof data.variant_values === "object" ? data.variant_values : {},
            })
            .run();
        }
      } else {
        const data = change.data as Record<string, unknown>;
        const categoryId = Number(change.external_ref.replace(/^cf_category_/, ""));
        if (!Number.isInteger(categoryId) || categoryId <= 0) throw new Error("Invalid category external_ref");
        const existing = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).get();
        if (change.action === "deactivate") {
          if (existing) await db.update(categories).set({ isActive: 0, updatedAt: sql`datetime('now')` }).where(eq(categories.id, categoryId)).run();
        } else if (existing) {
          await db.update(categories).set({ name: typeof data.name === "string" ? data.name : undefined, parentId: typeof data.parent_cloudflare_id === "number" ? data.parent_cloudflare_id : undefined, isActive: typeof data.is_active === "boolean" ? (data.is_active ? 1 : 0) : 1, updatedAt: sql`datetime('now')` }).where(eq(categories.id, categoryId)).run();
        } else {
          await db.insert(categories).values({ id: categoryId, name: typeof data.name === "string" ? data.name : change.external_ref, parentId: typeof data.parent_cloudflare_id === "number" ? data.parent_cloudflare_id : null, isActive: typeof data.is_active === "boolean" ? (data.is_active ? 1 : 0) : 1 }).run();
        }
      }
      results.push({ change_id: change.change_id, result: "applied" });
    } catch (error) {
      results.push({ change_id: change.change_id, result: `error: ${String(error)}` });
    }
  }

  // D1/SQLite has a limit on bound variables per statement. Keep the audit
  // insert separate from the product loop and write it in small chunks.
  for (let start = 0; start < body.changes.length; start += 10) {
    const changes = body.changes.slice(start, start + 10);
    await db
      .insert(catalogChangeLog)
      .values(
        changes.map((change, index) => ({
          changeId: change.change_id,
          entityType: change.entity_type,
          entityRef: change.external_ref,
          action: change.action,
          payload: JSON.stringify(change.data),
          appliedAt: sql`datetime('now')`,
          result: results[start + index].result,
        })),
      )
      .onConflictDoNothing()
      .run();
  }

  return c.json({ results });
});

export default app;
