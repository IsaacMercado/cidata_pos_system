import { addRxPlugin, createRxDatabase, removeRxDatabase, type RxDatabase, type RxJsonSchema, type RxCollection } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { RxDBLeaderElectionPlugin } from "rxdb/plugins/leader-election";
import { RxDBMigrationSchemaPlugin } from "rxdb/plugins/migration-schema";
import { replicateRxCollection } from "rxdb/plugins/replication";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { loadSession } from "./session";
import { api } from "./api";

addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBMigrationSchemaPlugin);

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export interface ProductDoc {
  rxid: string;
  id: number;
  code: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: number | null;
  categoryName: string | null;
  price: number;
  cost: number;
  taxRate: number;
  unit: string;
  minStock: number;
  currentStock: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
  _deleted: boolean;
}

export interface RestaurantDoc {
  rxid: string;
  id: number;
  name: string;
  description: string | null;
  isActive: number;
  createdAt: string;
  updatedAt: string;
  _deleted: boolean;
}

export interface RestaurantTableDoc {
  rxid: string;
  id: number;
  restaurantId: number;
  name: string;
  capacity: number;
  status: string;
  shape: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
  _deleted: boolean;
}

export interface OperatorDoc {
  rxid: string;
  id: number;
  username: string;
  name: string;
  role: string;
  isSuperuser: number;
  pinHash: string;
  updatedAt: string;
  _deleted: boolean;
}

export interface PendingOpDoc {
  rxid: string;
  type: string;
  payload: any;
  createdAt: string;
  retries: number;
}

const productSchema: RxJsonSchema<ProductDoc> = {
  title: "product",
  version: 4,
  primaryKey: "rxid",
  type: "object",
  properties: {
    rxid: { type: "string", maxLength: 36 },
    id: { type: "number" },
    code: { type: "string" },
    barcode: { type: ["string", "null"] },
    name: { type: "string", maxLength: 255 },
    description: { type: ["string", "null"] },
    categoryId: { type: ["number", "null"] },
    categoryName: { type: ["string", "null"] },
    price: { type: "number" },
    cost: { type: "number" },
    taxRate: { type: "number" },
    unit: { type: "string" },
    minStock: { type: "number" },
    currentStock: { type: "number" },
    isActive: { type: "number", multipleOf: 1, minimum: 0, maximum: 1 },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
    _deleted: { type: "boolean", default: false },
  },
  required: ["rxid", "id", "code", "name", "isActive"],
  indexes: [["isActive", "name"]],
};

const restaurantSchema: RxJsonSchema<RestaurantDoc> = {
  title: "restaurant",
  version: 4,
  primaryKey: "rxid",
  type: "object",
  properties: {
    rxid: { type: "string", maxLength: 36 },
    id: { type: "number" },
    name: { type: "string" },
    description: { type: ["string", "null"] },
    isActive: { type: "number" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
    _deleted: { type: "boolean", default: false },
  },
  required: ["rxid", "id", "name", "isActive"],
};

const restaurantTableSchema: RxJsonSchema<RestaurantTableDoc> = {
  title: "restaurant_table",
  version: 4,
  primaryKey: "rxid",
  type: "object",
  properties: {
    rxid: { type: "string", maxLength: 36 },
    id: { type: "number" },
    restaurantId: { type: "number", multipleOf: 1, minimum: 1, maximum: 999999 },
    name: { type: "string" },
    capacity: { type: "number" },
    status: { type: "string" },
    shape: { type: "string" },
    posX: { type: "number" },
    posY: { type: "number" },
    width: { type: "number" },
    height: { type: "number" },
    isActive: { type: "number" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
    _deleted: { type: "boolean", default: false },
  },
  required: ["rxid", "id", "name", "restaurantId"],
  indexes: ["restaurantId"],
};

const pendingOpSchema: RxJsonSchema<PendingOpDoc> = {
  title: "pending_op",
  version: 1,
  primaryKey: "rxid",
  type: "object",
  properties: {
    rxid: { type: "string", maxLength: 36 },
    type: { type: "string" },
    payload: { type: ["object", "null"] },
    createdAt: { type: "string" },
    retries: { type: "number" },
  },
  required: ["rxid", "type", "payload", "createdAt", "retries"],
};

const operatorSchema: RxJsonSchema<OperatorDoc> = {
  title: "operator",
  version: 4,
  primaryKey: "rxid",
  type: "object",
  properties: {
    rxid: { type: "string", maxLength: 36 },
    id: { type: "number" },
    username: { type: "string", maxLength: 100 },
    name: { type: "string" },
    role: { type: "string" },
    isSuperuser: { type: "number" },
    pinHash: { type: "string" },
    updatedAt: { type: "string" },
    _deleted: { type: "boolean", default: false },
  },
  required: ["rxid", "id", "username", "name", "role", "isSuperuser", "pinHash", "updatedAt"],
  indexes: ["username"],
};

export type RxCollections = {
  products: RxCollection<ProductDoc>;
  restaurants: RxCollection<RestaurantDoc>;
  restaurant_tables: RxCollection<RestaurantTableDoc>;
  operators: RxCollection<OperatorDoc>;
  pending_ops: RxCollection<PendingOpDoc>;
};

let dbPromise: Promise<RxDatabase<RxCollections>> | null = null;

const DB_NAME = "pos_offline";

function makeStorage() {
  return wrappedValidateAjvStorage({ storage: getRxStorageDexie() });
}

const createDatabase = async (): Promise<RxDatabase<RxCollections>> => {
    if (import.meta.env.DEV) addRxPlugin(RxDBDevModePlugin);

    const db = await createRxDatabase<RxCollections>({
        name: DB_NAME,
        storage: makeStorage(),
        multiInstance: true,
        eventReduce: true,
        ignoreDuplicate: true,
    });

    db.waitForLeadership().then(() => {
        console.log('isLeader now');
    });

    await db.addCollections({
      products: {
        schema: productSchema,
        migrationStrategies: { 1: (d) => d, 2: (d) => d, 3: (d) => d, 4: (d) => d },
      },
      restaurants: {
        schema: restaurantSchema,
        migrationStrategies: { 1: (d) => d, 2: (d) => d, 3: (d) => d, 4: (d) => d },
      },
      restaurant_tables: {
        schema: restaurantTableSchema,
        migrationStrategies: { 1: (d) => d, 2: (d) => d, 3: (d) => d, 4: (d) => d },
      },
      operators: {
        schema: operatorSchema,
        migrationStrategies: { 1: (d) => d, 2: (d) => d, 3: (d) => d, 4: (d) => d },
      },
      pending_ops: {
        schema: pendingOpSchema,
        migrationStrategies: { 1: (d) => d },
      },
    });

    startReplication(db.products, "products");
    startReplication(db.restaurants, "restaurants");
    startReplication(db.restaurant_tables, "restaurant_tables");
    startReplication(db.operators, "operators");

    return db;
};

// The local DB is only a refillable cache. If the schema hash changes during
// development (DB6/COL12), wipe the local DB and recreate it instead of failing.
// If recreation also fails, the error propagates to the UI.
const getDatabaseInner = async (): Promise<RxDatabase<RxCollections>> => {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await createDatabase();
    } catch (err) {
      const rxErr = err as any;
      if (attempt === 0) {
        console.warn("RxDB init error — recreating cache DB:", rxErr?.code ?? rxErr?.message);
        await removeRxDatabase(DB_NAME, getRxStorageDexie());
        continue;
      }
      throw err;
    }
  }
  throw new Error("RxDB init failed after retry");
};

function authHeaders(): HeadersInit {
  const session = loadSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.token) headers["Authorization"] = `Bearer ${session.token}`;
  return headers;
}

function startReplication(collection: RxCollection<any>, name: string) {
  return replicateRxCollection({
    collection,
    replicationIdentifier: "server",
    live: true,
    retryTime: 5000,
    deletedField: "_deleted",
    pull: {
      async handler(checkpoint: any, batchSize: number) {
        const res = await fetch(`${API_BASE}/replicate/${name}/pull`, {
          method: "POST",
          headers: authHeaders(),
          credentials: "include",
          body: JSON.stringify({ checkpoint: checkpoint ?? null, limit: batchSize }),
        });
        const data = await res.json();
        return { documents: data.documents ?? [], checkpoint: data.checkpoint ?? null };
      },
    },
  });
}

export async function syncPendingOps() {
  const db = await getDatabase();
  const docs = await db.pending_ops.find().exec();

  for (const doc of docs) {
    try {
      switch (doc.type) {
        case "create_sale":
          await api.sales.create(doc.payload);
          break;
        case "pay_sale":
          await api.sales.pay(doc.payload.saleId, doc.payload);
          break;
        case "create_customer":
          await api.customers.create(doc.payload);
          break;
        case "update_product":
          await api.products.update(doc.payload.id, doc.payload);
          break;
      }
      await doc.remove();
    } catch (e) {
      const nextRetries = doc.retries + 1;
      if (nextRetries >= 5) {
        console.error("Permanent sync failure, skipping:", doc.type, e);
        await doc.remove();
      } else {
        await (doc as any).update({ retries: nextRetries });
      }
    }
  }
}

export const getDatabase = (): Promise<RxDatabase<RxCollections>> => {
    if (!dbPromise) {
        dbPromise = getDatabaseInner().catch((e) => {
            dbPromise = null;
            throw e;
        });
    }
    return dbPromise;
};
