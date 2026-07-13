import { openDB, type IDBPDatabase } from "idb";

// Offline queue for sales (and other writes) made without connectivity.
// Reference data (products, restaurants, tables, operators) is now handled by RxDB.
const DB_NAME = "pos-offline";
const DB_VERSION = 3;

type PendingOpType = "create_sale" | "create_customer" | "update_product" | "pay_sale";

interface PendingOp {
  id?: number;
  type: PendingOpType;
  payload: any;
  createdAt: string;
  retries: number;
}

interface StoreSchema {
  pending_ops: {
    key: number;
    value: PendingOp;
  };
}

let dbPromise: Promise<IDBPDatabase<StoreSchema>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<StoreSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("pending_ops")) {
          db.createObjectStore("pending_ops", {
            keyPath: "id",
            autoIncrement: true,
          });
        }
      },
    });
  }
  return dbPromise;
}

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
