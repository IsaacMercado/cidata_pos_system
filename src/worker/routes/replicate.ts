import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import {
  categories,
  products,
  restaurantTables,
  restaurants,
  users,
} from "../db/schema";
import type { Env } from "../index";

const app = new Hono<Env>();

// Pull-only replication: the client replicates reference data from the server.
// Writes still go through the existing REST API (so D1 triggers keep working).
type CollectionConfig = {
  query: (
    db: Env["Variables"]["db"],
    cpUpdated: string,
    cpId: number,
    limit: number,
  ) => Promise<any[]>;
  transform: (row: any) => any;
};

const orderByUpdated = (table: string) =>
  sql`${sql.raw(`${table}.updated_at`)} ASC, ${sql.raw(`${table}.id`)} ASC`;
const whereUpdated = (table: string, cpUpdated: string, cpId: number) =>
  sql`(${sql.raw(`${table}.updated_at`)} > ${cpUpdated}) OR (${sql.raw(`${table}.updated_at`)} = ${cpUpdated} AND ${sql.raw(`${table}.id`)} > ${cpId})`;

const COLLECTIONS: Record<string, CollectionConfig> = {
  products: {
    query: (db, cpUpdated, cpId, limit) =>
      db
        .select()
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(whereUpdated("products", cpUpdated, cpId))
        .orderBy(orderByUpdated("products"))
        .limit(limit),
    transform: (row) => ({
      rxid: String(row.products.id),
      id: row.products.id,
      code: row.products.code,
      barcode: row.products.barcode,
      name: row.products.name,
      description: row.products.description,
      categoryId: row.products.categoryId,
      categoryName: row.categories?.name ?? null,
      price: row.products.price,
      cost: row.products.cost,
      taxRate: row.products.taxRate,
      unit: row.products.unit,
      minStock: row.products.minStock,
      currentStock: row.products.currentStock,
      isActive: row.products.isActive,
      createdAt: row.products.createdAt,
      updatedAt: row.products.updatedAt,
      _deleted: false,
    }),
  },
  restaurants: {
    query: (db, cpUpdated, cpId, limit) =>
      db
        .select()
        .from(restaurants)
        .where(whereUpdated("restaurants", cpUpdated, cpId))
        .orderBy(orderByUpdated("restaurants"))
        .limit(limit),
    transform: (row) => ({ ...row, rxid: String(row.id), _deleted: false }),
  },
  restaurant_tables: {
    query: (db, cpUpdated, cpId, limit) =>
      db
        .select()
        .from(restaurantTables)
        .where(whereUpdated("restaurant_tables", cpUpdated, cpId))
        .orderBy(orderByUpdated("restaurant_tables"))
        .limit(limit),
    transform: (row) => ({ ...row, rxid: String(row.id), _deleted: false }),
  },
  operators: {
    query: (db, cpUpdated, cpId, limit) =>
      db
        .select({
          id: users.id,
          username: users.username,
          name: users.name,
          role: users.role,
          isSuperuser: users.isSuperuser,
          pinHash: users.pinHash,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(whereUpdated("users", cpUpdated, cpId))
        .orderBy(orderByUpdated("users"))
        .limit(limit),
    transform: (row) => ({ ...row, rxid: String(row.id), _deleted: false }),
  },
};

app.post("/:collection/pull", async (c) => {
  const collection = c.req.param("collection");
  const cfg = COLLECTIONS[collection];
  if (!cfg) return c.json({ error: "Unknown collection" }, 400);

  const db = c.get("db");
  const { checkpoint, limit = 100 } = await c.req.json<{
    checkpoint: { updatedAt: string; id: number } | null;
    limit?: number;
  }>();

  const cpUpdated = checkpoint?.updatedAt ?? "";
  const cpId = checkpoint?.id ?? 0;

  const rows = await cfg.query(db, cpUpdated, cpId, limit);
  const documents = rows.map(cfg.transform);

  const last = documents[documents.length - 1];
  const newCheckpoint = last
    ? { updatedAt: last.updatedAt, id: last.id }
    : null;

  return c.json({ documents, checkpoint: newCheckpoint });
});

export default app;
