import { Hono } from "hono";
import type { Env } from "../index";
import { SyncService } from "../services/sync";
import { syncLog } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";

const app = new Hono<Env>();

app.post("/start", async (c) => {
  const db = c.get("db");
  const env = c.get("env");

  const syncService = new SyncService({
    url: env.ODOO_URL,
    db: env.ODOO_DB,
    username: env.ODOO_USERNAME,
    password: env.ODOO_PASSWORD,
  });

  try {
    const result = await syncService.syncAll(db);
    return c.json({
      data: {
        synced: result.synced,
        errors: result.errors,
        message: `Sincronización completada: ${result.synced} exitosos, ${result.errors} errores`,
      },
    });
  } catch (e) {
    return c.json(
      { error: `Sync failed: ${(e as Error).message}` },
      500,
    );
  }
});

app.post("/pull/products", async (c) => {
  const db = c.get("db");
  const env = c.get("env");

  const syncService = new SyncService({
    url: env.ODOO_URL,
    db: env.ODOO_DB,
    username: env.ODOO_USERNAME,
    password: env.ODOO_PASSWORD,
  });

  try {
    const count = await syncService.pullProducts(db);
    return c.json({ data: { imported: count } });
  } catch (e) {
    return c.json(
      { error: `Pull products failed: ${(e as Error).message}` },
      500,
    );
  }
});

app.post("/pull/customers", async (c) => {
  const db = c.get("db");
  const env = c.get("env");

  const syncService = new SyncService({
    url: env.ODOO_URL,
    db: env.ODOO_DB,
    username: env.ODOO_USERNAME,
    password: env.ODOO_PASSWORD,
  });

  try {
    const count = await syncService.pullCustomers(db);
    return c.json({ data: { imported: count } });
  } catch (e) {
    return c.json(
      { error: `Pull customers failed: ${(e as Error).message}` },
      500,
    );
  }
});

app.get("/log", async (c) => {
  const db = c.get("db");
  const limit = Number(c.req.query("limit") || 50);
  const status = c.req.query("status");

  const conditions = [];
  if (status) conditions.push(eq(syncLog.status, status));

  const result = await db
    .select()
    .from(syncLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`created_at DESC`)
    .limit(limit)
    .all();

  return c.json({ data: result });
});

export default app;
