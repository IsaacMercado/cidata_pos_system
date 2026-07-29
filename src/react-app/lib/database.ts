import { addRxPlugin, createRxDatabase, removeRxDatabase, type RxDatabase, type RxJsonSchema, type RxCollection } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { RxDBLeaderElectionPlugin } from "rxdb/plugins/leader-election";
import { RxDBMigrationSchemaPlugin } from "rxdb/plugins/migration-schema";
import { replicateRxCollection } from "rxdb/plugins/replication";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { loadSession } from "./session";

addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBMigrationSchemaPlugin);

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export interface ProductRate {
  code: string;
  name: string;
  rate: number;
  fetchedAt: string;
}

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
  rates: ProductRate[];
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

export interface SaleItemData {
  productId: number;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}

export interface SalePaymentData {
  paymentMethodId: number;
  amount: number;
  currency?: string;
  reference?: string | null;
  paymentDate?: string | null;
  phone?: string | null;
}

export interface SaleDoc {
  rxid: string;
  clientId: string;
  serverId: number | null;
  customerId: number | null;
  userId: number | null;
  tableId: number | null;
  tableName: string | null;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  status: string;
  notes: string | null;
  items: SaleItemData[];
  payments: SalePaymentData[];
  syncStatus: string;
  receiptNumber: string | null;
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

const productSchema: RxJsonSchema<ProductDoc> = {
  title: "product",
  version: 5,
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
    rates: {
      type: "array",
      default: [],
      items: {
        type: "object",
        properties: {
          code: { type: "string" },
          name: { type: "string" },
          rate: { type: "number" },
          fetchedAt: { type: "string" },
        },
      },
    },
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

const saleSchema: RxJsonSchema<SaleDoc> = {
  title: "sale",
  version: 1,
  primaryKey: "rxid",
  type: "object",
  properties: {
    rxid: { type: "string", maxLength: 36 },
    clientId: { type: "string", maxLength: 100 },
    serverId: { type: ["number", "null"] },
    customerId: { type: ["number", "null"] },
    userId: { type: ["number", "null"] },
    tableId: { type: ["number", "null"] },
    tableName: { type: ["string", "null"] },
    subtotal: { type: "number" },
    taxTotal: { type: "number" },
    discountTotal: { type: "number" },
    total: { type: "number" },
    status: { type: "string", maxLength: 50 },
    notes: { type: ["string", "null"] },
    items: {
      type: "array",
      default: [],
      items: {
        type: "object",
        properties: {
          productId: { type: "number" },
          quantity: { type: "number" },
          unitPrice: { type: "number" },
          discountPercent: { type: "number" },
        },
      },
    },
    payments: {
      type: "array",
      default: [],
      items: {
        type: "object",
        properties: {
          paymentMethodId: { type: "number" },
          amount: { type: "number" },
          currency: { type: ["string", "null"] },
          reference: { type: ["string", "null"] },
          paymentDate: { type: ["string", "null"] },
          phone: { type: ["string", "null"] },
        },
      },
    },
    syncStatus: { type: "string", maxLength: 20 },
    receiptNumber: { type: ["string", "null"], maxLength: 50 },
    createdAt: { type: "string", maxLength: 30 },
    updatedAt: { type: "string", maxLength: 30 },
    _deleted: { type: "boolean", default: false },
  },
  required: ["rxid", "clientId", "subtotal", "taxTotal", "discountTotal", "total", "status", "syncStatus", "createdAt", "updatedAt"],
  indexes: [["syncStatus"], ["createdAt"]],
};

export type RxCollections = {
  products: RxCollection<ProductDoc>;
  restaurants: RxCollection<RestaurantDoc>;
  restaurant_tables: RxCollection<RestaurantTableDoc>;
  operators: RxCollection<OperatorDoc>;
  sales: RxCollection<SaleDoc>;
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
        migrationStrategies: {
          1: (d) => d,
          2: (d) => d,
          3: (d) => d,
          4: (d) => d,
          5: (d) => ({ ...d, rates: Array.isArray((d as any).rates) ? (d as any).rates : [] }),
        },
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
      sales: {
        schema: saleSchema,
        migrationStrategies: { 1: (d) => d },
      },
    });

    startReplication(db.products, "products");
    startReplication(db.restaurants, "restaurants");
    startReplication(db.restaurant_tables, "restaurant_tables");
    startReplication(db.operators, "operators");
    startPushReplication(db.sales, "sales");

    return db;
  };

const DB_INIT_VERSION = "3";

// The local DB is only a refillable cache. On init version bump, wipe and recreate
// so the pull replication re-fetches all data with the latest schema.
const getDatabaseInner = async (): Promise<RxDatabase<RxCollections>> => {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem("rxdb:init") : null;
  if (stored !== DB_INIT_VERSION) {
    try {
      await removeRxDatabase(DB_NAME, getRxStorageDexie());
    } catch { /* might not exist yet */ }
    localStorage.setItem("rxdb:init", DB_INIT_VERSION);
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await createDatabase();
    } catch (err) {
      const rxErr = err as any;
      if (attempt === 0) {
        console.warn("RxDB init error — recreating cache DB:", rxErr?.code ?? rxErr?.message);
        try { await removeRxDatabase(DB_NAME, getRxStorageDexie()); } catch {}
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

function startPushReplication(collection: RxCollection<any>, name: string) {
  return replicateRxCollection({
    collection,
    replicationIdentifier: "push-server",
    live: true,
    retryTime: 5000,
    deletedField: "_deleted",
    push: {
      handler: async (documents: any[]) => {
        const session = loadSession();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (session?.token) headers["Authorization"] = `Bearer ${session.token}`;

        const results: any[] = [];
        for (const doc of documents) {
          const docData = doc.newDocumentState ?? doc;
          try {
            const res = await fetch(`${API_BASE}/replicate/${name}/push`, {
              method: "POST",
              headers,
              credentials: "include",
              body: JSON.stringify({
                clientId: docData.clientId,
                rxid: docData.rxid,
                items: docData.items,
                payments: docData.payments,
                customerId: docData.customerId,
                userId: docData.userId,
                tableId: docData.tableId,
                notes: docData.notes,
                status: docData.status,
              }),
            });
            const responseData = await res.json();
            if (res.ok && responseData.success) {
              results.push({ document: doc, ok: true });
            } else {
              throw new Error(responseData.error || "Push failed");
            }
          } catch (e) {
            results.push({ document: doc, error: e, ok: false });
          }
        }
        return results as any;
      },
    },
  });
}

export async function resetDatabase() {
  try {
    dbPromise = null;
    await removeRxDatabase(DB_NAME, getRxStorageDexie());
    localStorage.removeItem("rxdb:init");
  } catch (e) {
    console.warn("Error resetting database:", e);
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
