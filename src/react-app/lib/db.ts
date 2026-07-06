import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "pos-offline";
const DB_VERSION = 3;

interface StoreSchema {
  products: {
    key: number;
    value: any;
    indexes: { "by-code": string; "by-name": string };
  };
  customers: {
    key: number;
    value: any;
    indexes: { "by-name": string };
  };
  sales: {
    key: number;
    value: any;
  };
  pending_ops: {
    key: number;
    value: {
      id?: number;
      type: "create_sale" | "create_customer" | "update_product" | "pay_sale";
      payload: any;
      createdAt: string;
      retries: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<StoreSchema>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<StoreSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("products")) {
          const products = db.createObjectStore("products", { keyPath: "id" });
          products.createIndex("by-code", "code");
          products.createIndex("by-name", "name");
        }
        if (!db.objectStoreNames.contains("customers")) {
          const customers = db.createObjectStore("customers", { keyPath: "id" });
          customers.createIndex("by-name", "name");
        }
        if (!db.objectStoreNames.contains("sales")) {
          db.createObjectStore("sales", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("pending_ops")) {
          db.createObjectStore("pending_ops", {
            keyPath: "id",
            autoIncrement: true,
          });
        }
        if (!db.objectStoreNames.contains("restaurants")) {
          db.createObjectStore("restaurants", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("restaurant_tables")) {
          const tables = db.createObjectStore("restaurant_tables", { keyPath: "id" });
          tables.createIndex("by-restaurant", "restaurantId");
        }
      },
    });
  }
  return dbPromise;
}

// ─── Products ──────────────────────────────────────────────────────────────

export async function cacheProducts(products: any[]) {
  const db = await getDb();
  const tx = db.transaction("products", "readwrite");
  for (const p of products) await tx.store.put(p);
  await tx.done;
}

export async function getCachedProducts(): Promise<any[]> {
  const db = await getDb();
  return db.getAll("products");
}

export async function searchCachedProducts(query: string): Promise<any[]> {
  const db = await getDb();
  const all = await db.getAll("products");
  const q = query.toLowerCase();
  return all.filter(
    (p: any) =>
      p.name?.toLowerCase().includes(q) ||
      p.code?.toLowerCase().includes(q) ||
      p.barcode?.includes(q),
  );
}

export async function getCachedProduct(id: number): Promise<any | undefined> {
  const db = await getDb();
  return db.get("products", id);
}

// ─── Customers ─────────────────────────────────────────────────────────────

export async function cacheCustomers(customers: any[]) {
  const db = await getDb();
  const tx = db.transaction("customers", "readwrite");
  for (const c of customers) await tx.store.put(c);
  await tx.done;
}

export async function getCachedCustomers(): Promise<any[]> {
  const db = await getDb();
  return db.getAll("customers");
}

// ─── Pending operations (offline queue) ────────────────────────────────────

export async function addPendingOp(op: Omit<PendingOp, "id" | "retries" | "createdAt">) {
  const db = await getDb();
  return db.add("pending_ops", {
    ...op,
    createdAt: new Date().toISOString(),
    retries: 0,
  });
}

export async function getPendingOps() {
  const db = await getDb();
  return db.getAll("pending_ops");
}

export async function removePendingOp(id: number) {
  const db = await getDb();
  return db.delete("pending_ops", id);
}

export async function incrementRetry(id: number) {
  const db = await getDb();
  const op = await db.get("pending_ops", id);
  if (op) {
    op.retries++;
    await db.put("pending_ops", op);
  }
}

export async function getPendingCount() {
  const db = await getDb();
  const all = await db.getAll("pending_ops");
  return all.length;
}

// ─── Sales cache ───────────────────────────────────────────────────────────

export async function cacheSale(sale: any) {
  const db = await getDb();
  await db.put("sales", sale);
}

export async function getCachedSales() {
  const db = await getDb();
  return db.getAll("sales");
}

// ─── Restaurants cache ─────────────────────────────────────────────────────

export async function cacheRestaurants(restaurants: any[]) {
  const db = await getDb();
  const tx = db.transaction("restaurants", "readwrite");
  for (const r of restaurants) await tx.store.put(r);
  await tx.done;
}

export async function getCachedRestaurants(): Promise<any[]> {
  const db = await getDb();
  return db.getAll("restaurants");
}

export async function getCachedRestaurant(id: number): Promise<any | undefined> {
  const db = await getDb();
  return db.get("restaurants", id);
}

export async function cacheRestaurantTables(_restaurantId: number, tables: any[]) {
  const db = await getDb();
  const tx = db.transaction("restaurant_tables", "readwrite");
  for (const t of tables) await tx.store.put(t);
  await tx.done;
}

export async function getCachedTables(restaurantId: number): Promise<any[]> {
  const db = await getDb();
  const index = db.transaction("restaurant_tables").store.index("by-restaurant");
  return index.getAll(restaurantId);
}

// ─── Clear all ─────────────────────────────────────────────────────────────

export async function clearAll() {
  const db = await getDb();
  const stores = db.objectStoreNames;
  const tx = db.transaction(stores, "readwrite");
  for (const store of stores) await tx.objectStore(store).clear();
  await tx.done;
}

export async function syncPendingOps() {
  const ops = await getPendingOps();
  if (ops.length === 0) return;

  const { api } = await import("./api");

  for (const op of ops) {
    try {
      switch (op.type) {
        case "create_sale":
          await api.sales.create(op.payload);
          break;
        case "pay_sale":
          await api.sales.pay(op.payload.saleId, op.payload);
          break;
        case "create_customer":
          await api.customers.create(op.payload);
          break;
        case "update_product":
          await api.products.update(op.payload.id, op.payload);
          break;
      }
      await removePendingOp(op.id!);
    } catch (e) {
      await incrementRetry(op.id!);
      if (op.retries >= 5) {
        console.error("Permanent sync failure, skipping:", op.type, e);
        await removePendingOp(op.id!);
      }
    }
  }
}

type PendingOp = {
  id?: number;
  type: "create_sale" | "create_customer" | "update_product" | "pay_sale";
  payload: any;
  createdAt: string;
  retries: number;
};
