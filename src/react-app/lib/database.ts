import {
  addRxPlugin,
  createRxDatabase,
  removeRxDatabase,
  type RxDatabase,
  type RxJsonSchema,
  type RxCollection,
} from "rxdb";
import { RxDBDevModePlugin, disableWarnings } from "rxdb/plugins/dev-mode";
import { RxDBLeaderElectionPlugin } from "rxdb/plugins/leader-election";
import { RxDBJsonDumpPlugin } from "rxdb/plugins/json-dump";
import { RxDBMigrationSchemaPlugin } from "rxdb/plugins/migration-schema";
import { replicateRxCollection } from "rxdb/plugins/replication";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { emitToast } from "../components/pos/Toast";
import { notifyAuthFailure } from "./api";
import { loadSession } from "./session";

addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBJsonDumpPlugin);
addRxPlugin(RxDBMigrationSchemaPlugin);
if (import.meta.env.DEV) disableWarnings();

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export interface ProductRate {
  code: string;
  name: string;
  rate: number;
  fetchedAt: string;
}

export interface ReservationRate {
  guests: number;
  price: number;
}

export interface ComboItemRef {
  componentProductId: number;
  quantity: number;
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
  productType: string;
  catalogStatus: string;
  minStock: number;
  currentStock: number;
  externalId?: string | null;
  templateExternalId?: string | null;
  variantExternalId?: string | null;
  attributeValues: Record<string, string>;
  taxExternalId?: string | null;
  catalogVersion: number;
  stockProjection: number;
  stockOfficial: number | null;
  isActive: number;
  rates: ProductRate[];
  reservationRates: ReservationRate[];
  comboItems: ComboItemRef[];
  variantGroupId?: number | null;
  variantAttributes: string[];
  variantValues: Record<string, string>;
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
  discounts?: import("./types").LineDiscount[];
}

export interface SalePaymentData {
  paymentMethodId: number;
  amount: number;
  currency?: string;
  amountOriginal?: number;
  exchangeRate?: number;
  amountUsd?: number;
  reference?: string | null;
  paymentDate?: string | null;
  phone?: string | null;
}

export interface ReservationData {
  productId: number;
  checkIn: string;
  checkOut: string;
  total: number;
  guests?: number;
  guestPrice?: number;
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
  reservations?: ReservationData[];
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
  updatedAt: string;
  _deleted: boolean;
}

const productSchema: RxJsonSchema<ProductDoc> = {
  title: "product",
  version: 3,
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
    productType: { type: "string", default: "simple" },
    catalogStatus: { type: "string", default: "active" },
    minStock: { type: "number" },
    currentStock: { type: "number" },
    externalId: { type: ["string", "null"] },
    templateExternalId: { type: ["string", "null"] },
    variantExternalId: { type: ["string", "null"] },
    attributeValues: { type: "object", default: {} },
    taxExternalId: { type: ["string", "null"] },
    catalogVersion: { type: "number", default: 1 },
    stockProjection: { type: "number", default: 0 },
    stockOfficial: { type: ["number", "null"] },
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
    reservationRates: {
      type: "array",
      default: [],
      items: {
        type: "object",
        properties: {
          guests: { type: "number" },
          price: { type: "number" },
        },
        required: ["guests", "price"],
      },
    },
    comboItems: {
      type: "array",
      default: [],
      items: {
        type: "object",
        properties: {
          componentProductId: { type: "number" },
          quantity: { type: "number" },
        },
      },
    },
    variantGroupId: { type: ["number", "null"] },
    variantAttributes: { type: "array", default: [], items: { type: "string" } },
    variantValues: { type: "object", default: {} },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
    _deleted: { type: "boolean", default: false },
  },
  required: ["rxid", "id", "code", "name", "isActive"],
  indexes: [["isActive", "name"]],
};

const restaurantSchema: RxJsonSchema<RestaurantDoc> = {
  title: "restaurant",
  version: 0,
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
  version: 0,
  primaryKey: "rxid",
  type: "object",
  properties: {
    rxid: { type: "string", maxLength: 36 },
    id: { type: "number" },
    restaurantId: {
      type: "number",
      multipleOf: 1,
      minimum: 1,
      maximum: 999999,
    },
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
  version: 1,
  primaryKey: "rxid",
  type: "object",
  properties: {
    rxid: { type: "string", maxLength: 36 },
    id: { type: "number" },
    username: { type: "string", maxLength: 100 },
    name: { type: "string" },
    role: { type: "string" },
    isSuperuser: { type: "number" },
    updatedAt: { type: "string" },
    _deleted: { type: "boolean", default: false },
  },
  required: [
    "rxid",
    "id",
    "username",
    "name",
    "role",
    "isSuperuser",
    "updatedAt",
  ],
  indexes: ["username"],
};

const saleSchema: RxJsonSchema<SaleDoc> = {
  title: "sale",
  // Version 2 adds the original-currency payment audit fields.
  version: 2,
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
              discounts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    type: { type: "string" },
                    value: { type: "number" },
                    label: { type: ["string", "null"] },
                  },
                },
              },
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
          amountOriginal: { type: ["number", "null"] },
          exchangeRate: { type: ["number", "null"] },
          amountUsd: { type: ["number", "null"] },
          reference: { type: ["string", "null"] },
          paymentDate: { type: ["string", "null"] },
          phone: { type: ["string", "null"] },
        },
      },
    },
    reservations: {
      type: "array",
      default: [],
      items: {
        type: "object",
        properties: {
          productId: { type: "number" },
          checkIn: { type: "string" },
          checkOut: { type: "string" },
          total: { type: "number" },
        },
        required: ["productId", "checkIn", "checkOut", "total"],
      },
    },
    syncStatus: { type: "string", maxLength: 20 },
    receiptNumber: { type: ["string", "null"], maxLength: 50 },
    createdAt: { type: "string", maxLength: 30 },
    updatedAt: { type: "string", maxLength: 30 },
    _deleted: { type: "boolean", default: false },
  },
  required: [
    "rxid",
    "clientId",
    "subtotal",
    "taxTotal",
    "discountTotal",
    "total",
    "status",
    "syncStatus",
    "createdAt",
    "updatedAt",
  ],
  indexes: [["syncStatus"], ["createdAt"]],
};

export type RxCollections = {
  products: RxCollection<ProductDoc>;
  restaurants: RxCollection<RestaurantDoc>;
  restaurant_tables: RxCollection<RestaurantTableDoc>;
  operators: RxCollection<OperatorDoc>;
  sales: RxCollection<SaleDoc>;
};

const DB_NAME = import.meta.env.VITE_RXDB_DATABASE_NAME || "pos_offline";

let databaseTraceSequence = 0;
function traceDatabase(event: string, details?: unknown) {
  const prefix = `[RxDB trace ${++databaseTraceSequence}] ${new Date().toISOString()} ${event}`;
  if (details === undefined) console.log(prefix);
  else console.log(prefix, details);
}

function traceMigration(collection: string, targetVersion: number, doc: any, result: any) {
  traceDatabase(`migration ${collection} ${targetVersion - 1}->${targetVersion}`, {
    rxid: doc?.rxid,
    id: doc?.id,
    resultRxid: result?.rxid,
  });
}

type DatabaseRuntime = { promise: Promise<RxDatabase<RxCollections>> | null };
const databaseRuntime = ((globalThis as typeof globalThis & {
  __posDatabaseRuntime?: DatabaseRuntime;
}).__posDatabaseRuntime ??= { promise: null });
const activeReplications: { cancel: () => Promise<void> | void }[] = [];
let databaseClosing = false;

function makeStorage() {
  return wrappedValidateAjvStorage({ storage: getRxStorageDexie() });
}

function isSalesMigrationFailure(error: unknown) {
  const errorObject = error as { message?: unknown; stack?: unknown } | null;
  const text = `${String(errorObject?.message ?? "")} ${String(errorObject?.stack ?? "")} ${String(error)}`.toLowerCase();
  return text.includes("pos_offline-sales") ||
    text.includes(`${DB_NAME.toLowerCase()}-sales`) ||
    text.includes("sales-v-2") ||
    text.includes("migration") && text.includes("sales");
}

function deleteIndexedDb(name: string) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`No se pudo eliminar ${name}`));
    request.onblocked = () => reject(new Error(`La base ${name} sigue bloqueada`));
  });
}

async function recoverFailedSalesMigration() {
  if (typeof indexedDB === "undefined") return false;
  const prefix = `rxdb-dexie-${DB_NAME}--`;
  const internalName = `${prefix}0--_rxdb_internal`;
  const internal = await new Promise<any>((resolve, reject) => {
    const request = indexedDB.open(internalName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("docs")) {
        database.close();
        resolve(null);
        return;
      }
      const read = database.transaction("docs", "readonly").objectStore("docs").get("collection|sales-2");
      read.onsuccess = () => {
        const doc = read.result;
        database.close();
        resolve(doc);
      };
      read.onerror = () => {
        database.close();
        reject(read.error);
      };
    };
  });

  const connectedMeta = internal?.data?.connectedStorages ?? [];
  const salesMetaNames = connectedMeta
    .map((meta: any) => meta.collectionName)
    .filter((name: unknown): name is string => typeof name === "string");
  const databaseNames = (await indexedDB.databases())
    .map((database) => database.name)
    .filter((name): name is string => Boolean(name));
  const targetNames = databaseNames.filter((name) =>
    name === `${prefix}2--sales` ||
    name === `${prefix}1--rx-migration-state-meta-sales-1` ||
    salesMetaNames.some((metaName: string) => name === `${prefix}2--${metaName}`),
  );

  if (!targetNames.length && !internal) return false;
  traceDatabase("sales-migration-recovery:start", { targetNames, hasInternalMeta: Boolean(internal) });
  await Promise.all(targetNames.map((name) => deleteIndexedDb(name)));

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(internalName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("docs")) {
        database.close();
        resolve();
        return;
      }
      const transaction = database.transaction("docs", "readwrite");
      transaction.objectStore("docs").delete("rx-migration-status|sales-v-2");
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
    };
  });
  traceDatabase("sales-migration-recovery:done", { preservedCollection: `${prefix}1--sales` });
  return true;
}

const createDatabase = async (): Promise<RxDatabase<RxCollections>> => {
  traceDatabase("createDatabase:start", { name: DB_NAME });
  if (import.meta.env.DEV) {
    addRxPlugin(RxDBDevModePlugin);
  }

  traceDatabase("createDatabase:createRxDatabase:start");
  const db = await createRxDatabase<RxCollections>({
    name: DB_NAME,
    storage: makeStorage(),
    multiInstance: true,
    eventReduce: true,
  });
  traceDatabase("createDatabase:createRxDatabase:done", { name: db.name });

  traceDatabase("createDatabase:addCollections:start");
  try {
    await db.addCollections({
    products: {
      schema: productSchema,
      migrationStrategies: {
        1: (doc: ProductDoc) => {
          const result = {
            ...doc,
          variantGroupId: doc.variantGroupId ?? null,
          variantAttributes: doc.variantAttributes ?? [],
          variantValues: doc.variantValues ?? {},
          };
          traceMigration("products", 1, doc, result);
          return result;
        },
        2: (doc: ProductDoc) => {
          const result = {
            ...doc,
          reservationRates: doc.reservationRates ?? [],
          };
          traceMigration("products", 2, doc, result);
          return result;
        },
        3: (doc: ProductDoc) => {
          const result = {
            ...doc,
          externalId: doc.externalId ?? doc.code ?? null,
          templateExternalId: doc.templateExternalId ?? null,
          variantExternalId: doc.variantExternalId ?? null,
          attributeValues: doc.attributeValues ?? {},
          taxExternalId: doc.taxExternalId ?? null,
          catalogVersion: doc.catalogVersion ?? 1,
          stockProjection: doc.stockProjection ?? doc.currentStock ?? 0,
          stockOfficial: doc.stockOfficial ?? null,
          };
          traceMigration("products", 3, doc, result);
          return result;
        },
      },
    },
    restaurants: { schema: restaurantSchema },
    restaurant_tables: { schema: restaurantTableSchema },
    operators: {
      schema: operatorSchema,
      migrationStrategies: { 1: (doc: any) => {
        traceDatabase("migration operators 0->1", { rxid: doc?.rxid, id: doc?.id });
        delete doc.pinHash;
        return doc;
      } },
    },
    sales: {
      schema: saleSchema,
      migrationStrategies: {
        1: (doc: any) => {
          traceMigration("sales", 1, doc, doc);
          return doc;
        },
        2: (doc: any) => {
          const result = {
            ...doc,
          items: (doc.items || []).map((item: any) =>
            item.discounts ? item : { ...item, discounts: [] },
          ),
          payments: (doc.payments || []).map((payment: any) => ({
            ...payment,
            amountOriginal: payment.amountOriginal ?? payment.amount ?? 0,
            exchangeRate: payment.exchangeRate ?? (payment.currency === "USD" ? 1 : null),
            amountUsd: payment.amountUsd ?? payment.amount ?? 0,
          })),
          };
          traceMigration("sales", 2, doc, result);
          return result;
        },
      },
    },
    });
  } catch (error) {
    traceDatabase("createDatabase:addCollections:error", error);
    await db.close().catch((closeError) => traceDatabase("createDatabase:close-after-error", closeError));
    throw error;
  }
  traceDatabase("createDatabase:addCollections:done", {
    collections: Object.keys(db.collections),
  });

  traceDatabase("createDatabase:startReplications");
  startReplication(db.products, "products");
  startReplication(db.restaurants, "restaurants");
  startReplication(db.restaurant_tables, "restaurant_tables");
  startReplication(db.operators, "operators");
  startPushReplication(db.sales);
  startPendingSalesRetry(db.sales);

  traceDatabase("createDatabase:done", { name: db.name });
  return db;
};

const getDatabaseInner = async (): Promise<RxDatabase<RxCollections>> => {
  traceDatabase("getDatabaseInner:start", { existingPromise: Boolean(databaseRuntime.promise) });
  databaseClosing = false;
  let salesRecoveryAttempted = false;
  try {
    while (true) {
      try {
        const db = await createDatabase();
        traceDatabase("getDatabaseInner:done", { name: db.name });
        return db;
      } catch (error) {
        if (salesRecoveryAttempted || !isSalesMigrationFailure(error)) throw error;
        salesRecoveryAttempted = true;
        const recovered = await recoverFailedSalesMigration();
        if (!recovered) throw error;
        traceDatabase("getDatabaseInner:retry-after-sales-recovery");
      }
    }
  } catch (error) {
    traceDatabase("getDatabaseInner:error", error);
    throw error;
  }
};

function authHeaders(): HeadersInit {
  const session = loadSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (session?.token) headers["Authorization"] = `Bearer ${session.token}`;
  return headers;
}

class ServerError extends Error {
  isServerError = true;
}

type SyncErrorInfo = {
  collection: string;
  direction: "push" | "pull";
  timestamp: string;
  message: string;
  status: number | null;
  statusText: string;
  requestUrl: string;
  requestBody: string;
  responseBody: string;
};

const lastServerErrorAt = new Map<string, number>();
const SERVER_ERROR_COOLDOWN_MS = 20_000;
const SERVER_ERROR_TOAST_DURATION = 15_000;
let pendingRetryTimer: number | null = null;
let pendingRetryInFlight: Promise<void> | null = null;
let retryHandler: (() => void) | null = null;
const pendingPushes = new Map<string, Promise<boolean>>();

function buildErrorLog(info: SyncErrorInfo): string {
  return [
    `Error de sincronización ${info.direction.toUpperCase()} — ${info.collection}`,
    `Fecha: ${info.timestamp}`,
    `Mensaje: ${info.message}`,
    ``,
    `=== Solicitud ===`,
    `Método: POST`,
    `URL: ${info.requestUrl}`,
    `Cuerpo:`,
    info.requestBody,
    ``,
    `=== Respuesta ===`,
    `Estado: ${info.status ?? "desconocido"}${info.statusText ? ` (${info.statusText})` : ""}`,
    `Cuerpo:`,
    info.responseBody,
  ].join("\n");
}

function downloadErrorLog(info: SyncErrorInfo) {
  const blob = new Blob([buildErrorLog(info)], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sync-error-${info.collection}-${info.direction}-${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function readIndexedDbDatabase(name: string) {
  const request = indexedDB.open(name);
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error(`Tiempo agotado al abrir ${name}`)),
      5000,
    );
    request.onsuccess = () => {
      window.clearTimeout(timeout);
      resolve(request.result);
    };
    request.onerror = () => {
      window.clearTimeout(timeout);
      reject(request.error ?? new Error(`No se pudo abrir ${name}`));
    };
    request.onblocked = () => {
      window.clearTimeout(timeout);
      reject(new Error(`La base ${name} esta bloqueada por otra instancia`));
    };
  });

  try {
    const stores = Array.from(database.objectStoreNames);
    const data: Record<string, unknown[]> = {};
    for (const storeName of stores) {
      data[storeName] = await new Promise<unknown[]>((resolve, reject) => {
        const transaction = database.transaction(storeName, "readonly");
        const request = transaction.objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result as unknown[]);
        request.onerror = () => reject(request.error ?? new Error(`No se pudo leer ${storeName}`));
      });
    }
    return { name, version: database.version, stores: data };
  } finally {
    database.close();
  }
}

export async function downloadDatabaseDiagnosticBackup() {
  if (!indexedDB.databases) {
    throw new Error("Este navegador no permite leer las bases IndexedDB para diagnóstico.");
  }
  const databases = await indexedDB.databases();
  const results: Array<Record<string, unknown>> = [];
  for (const database of databases) {
    if (!database.name || !database.name.includes("pos_offline")) continue;
    try {
      results.push(await readIndexedDbDatabase(database.name));
    } catch (error) {
      results.push({
        name: database.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (results.length === 0) {
    throw new Error("No se encontraron bases IndexedDB de pos_offline");
  }
  const dump = {
    format: "cidata-rxdb-indexeddb-diagnostic",
    exportedAt: new Date().toISOString(),
    databaseName: DB_NAME,
    databases: results,
  };
  const blob = new Blob([JSON.stringify(dump, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `pos-rxdb-diagnostic-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// Shows a toast (with a download button) for a server-side error. Network
// timeouts are not reported here, only real server responses with errors.
function reportServerError(info: SyncErrorInfo) {
  const now = Date.now();
  const key = `${info.direction}:${info.collection}:${info.message}`;
  const last = lastServerErrorAt.get(key) ?? 0;
  if (now - last >= SERVER_ERROR_COOLDOWN_MS) {
    lastServerErrorAt.set(key, now);
    console.error("RxDB replication server error", info);
    const session = loadSession();
    const isAdmin = session?.user.role === "admin" || session?.user.isSuperuser === 1;
    emitToast(
      info.message,
      "error",
      {
        label: isAdmin ? "Descargar BD + error" : "Descargar error",
        onClick: () => {
          downloadErrorLog(info);
          if (isAdmin) {
            void downloadDatabaseDiagnosticBackup().catch((error) => {
              window.alert(error instanceof Error ? error.message : "No se pudo descargar la base de diagnóstico.");
            });
          }
        },
      },
      SERVER_ERROR_TOAST_DURATION,
    );
  }
}

function buildPushBody(docData: any) {
  return {
    clientId: String(docData.clientId || docData.rxid),
    rxid: String(docData.rxid || docData.clientId),
    items: (docData.items || []).map((item: any) => ({
      productId: Number(item.productId),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discounts: Array.isArray(item.discounts)
        ? item.discounts.map((d: any) => ({
            type: String(d.type),
            value: Number(d.value),
            ...(d.label ? { label: String(d.label) } : {}),
          }))
        : [],
      discountPercent: Number(item.discountPercent || 0),
      discountAmount: Number(item.discountAmount || 0),
    })),
    payments: (docData.payments || []).map((payment: any) => ({
      paymentMethodId: Number(payment.paymentMethodId),
      amount: Number(payment.amount),
      currency: payment.currency || "USD",
      amountOriginal: Number(payment.amountOriginal ?? payment.amount),
      exchangeRate: Number(payment.exchangeRate ?? (payment.currency === "USD" ? 1 : 0)),
      amountUsd: Number(payment.amountUsd ?? payment.amount),
      ...(payment.reference ? { reference: String(payment.reference) } : {}),
      ...(payment.paymentDate ? { paymentDate: String(payment.paymentDate) } : {}),
      ...(payment.phone ? { phone: String(payment.phone) } : {}),
    })),
    ...(docData.customerId != null ? { customerId: Number(docData.customerId) } : {}),
    ...(docData.userId != null ? { userId: Number(docData.userId) } : {}),
    ...(docData.tableId != null ? { tableId: Number(docData.tableId) } : {}),
    ...(docData.notes != null ? { notes: String(docData.notes) } : {}),
    status: docData.status === "completed" ? "completed" : "in_progress",
    ...(Array.isArray(docData.reservations) ? { reservations: docData.reservations } : {}),
  };
}

async function pushSaleDocument(
  collection: RxCollection<any>,
  docData: any,
  document?: any,
): Promise<boolean> {
  traceDatabase("sales:push:start", {
    rxid: docData?.rxid,
    clientId: docData?.clientId,
    closing: databaseClosing,
    destroyed: collection.database.destroyed,
    hasDocument: Boolean(document),
  });
  if (databaseClosing || collection.database.destroyed) return false;
  const key = docData.clientId || docData.rxid;
  const running = pendingPushes.get(key);
  if (running) {
    traceDatabase("sales:push:deduplicated", { key });
    return running;
  }

  const promise = (async () => {
    const requestUrl = `${API_BASE}/replicate/sales/push`;
    const body = buildPushBody(docData);
    const requestBody = JSON.stringify(body, null, 2);
  const session = loadSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.token) headers.Authorization = `Bearer ${session.token}`;

    try {
      traceDatabase("sales:push:request", { key, requestUrl });
      const res = await fetch(requestUrl, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(body),
      });
      const { text, json } = await readResponse(res);
      traceDatabase("sales:push:response", { key, status: res.status, ok: res.ok, success: json?.success });
      if (!res.ok || !json?.success) {
        if (res.status === 401 || res.status === 403) {
          notifyAuthFailure(res.status, "/replicate/sales/push");
        }
        const message = json?.error || `No se pudo guardar la venta en el servidor (HTTP ${res.status})`;
        reportServerError({
          collection: "sales",
          direction: "push",
          timestamp: new Date().toISOString(),
          message,
          status: res.status,
          statusText: res.statusText,
          requestUrl,
          requestBody,
          responseBody: text,
        });
        return false;
      }

      const target = document || await collection.findOne(docData.rxid).exec();
      if (target) {
        traceDatabase("sales:push:patch:start", { key });
        await target.incrementalPatch({
          serverId: json.serverId ?? null,
          receiptNumber: json.receiptNumber ?? target.receiptNumber,
          syncStatus: "synced",
          updatedAt: new Date().toISOString(),
        });
        traceDatabase("sales:push:patch:done", { key });
      }
      traceDatabase("sales:push:done", { key });
      return true;
    } catch (error) {
      traceDatabase("sales:push:error", { key, error });
      reportServerError({
        collection: "sales",
        direction: "push",
        timestamp: new Date().toISOString(),
        message: "No se pudo conectar con el servidor. La venta seguirá pendiente.",
        status: null,
        statusText: "",
        requestUrl,
        requestBody,
        responseBody: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  })();

  pendingPushes.set(key, promise);
  try {
    traceDatabase("sales:push:await", { key });
    return await promise;
  } finally {
    pendingPushes.delete(key);
    traceDatabase("sales:push:finally", { key });
  }
}

async function retryPendingSales(collection: RxCollection<any>) {
  traceDatabase("sales:retry:start", {
    closing: databaseClosing,
    destroyed: collection.database.destroyed,
  });
  if (databaseClosing || collection.database.destroyed) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (typeof navigator !== "undefined" && navigator.onLine && !loadSession()?.token) return;
  const pending = await collection
    .find({ selector: { syncStatus: "pending" }, sort: [{ createdAt: "asc" }] })
    .exec();
  traceDatabase("sales:retry:found", { count: pending.length });
  for (const document of pending) {
    traceDatabase("sales:retry:document", { rxid: document.get("rxid"), syncStatus: document.get("syncStatus") });
    await pushSaleDocument(collection, document.toJSON(), document);
  }
  traceDatabase("sales:retry:done");
}

function startPendingSalesRetry(collection: RxCollection<any>) {
  if (typeof window === "undefined") return;
  const retry = async () => {
    traceDatabase("sales:retry:trigger", { closing: databaseClosing, inFlight: Boolean(pendingRetryInFlight) });
    if (databaseClosing || pendingRetryInFlight) return;
    const run = retryPendingSales(collection).catch((error) => {
      if (!databaseClosing) console.error("Pending sales retry failed", error);
    });
    pendingRetryInFlight = run;
    try {
      await run;
    } finally {
      if (pendingRetryInFlight === run) pendingRetryInFlight = null;
      if (!databaseClosing) pendingRetryTimer = window.setTimeout(retry, 15_000);
      traceDatabase("sales:retry:finally", { closing: databaseClosing });
    }
  };
  if (pendingRetryTimer !== null) window.clearTimeout(pendingRetryTimer);
  if (retryHandler) {
    window.removeEventListener("online", retryHandler);
    window.removeEventListener("focus", retryHandler);
  }
  retryHandler = () => { void retry(); };
  pendingRetryTimer = window.setTimeout(retry, 1_000);
  traceDatabase("sales:retry:scheduled", { delayMs: 1000 });
  window.addEventListener("online", retryHandler);
  window.addEventListener("focus", retryHandler);
}

// Helper to read the raw response body as text (keeps non-JSON error pages
// readable) and parse it as JSON when possible.
async function readResponse(res: Response): Promise<{
  text: string;
  json: any;
}> {
  let text: string;
  try {
    text = await res.text();
  } catch {
    text = "No se pudo leer la respuesta";
  }
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { text, json };
}

function startReplication(collection: RxCollection<any>, name: string) {
  traceDatabase("replication:pull:start", { name, db: collection.database.name });
  const replication = replicateRxCollection({
    collection,
    replicationIdentifier: "server",
    live: true,
    retryTime: 5000,
    deletedField: "_deleted",
    pull: {
      async handler(checkpoint: any, batchSize: number) {
        traceDatabase("replication:pull:handler", { name, checkpoint, batchSize });
        const requestUrl = `${API_BASE}/replicate/${name}/pull`;
        const requestBody = JSON.stringify(
          { checkpoint: checkpoint ?? null, limit: batchSize },
          null,
          2,
        );
        const res = await fetch(requestUrl, {
          method: "POST",
          headers: authHeaders(),
          credentials: "include",
          body: JSON.stringify({
            checkpoint: checkpoint ?? null,
            limit: batchSize,
          }),
        });
        const { text, json } = await readResponse(res);
        traceDatabase("replication:pull:response", {
          name,
          status: res.status,
          ok: res.ok,
          documentCount: Array.isArray(json?.documents) ? json.documents.length : null,
          checkpoint: json?.checkpoint,
        });
        if (!res.ok || !json || !Array.isArray(json.documents)) {
          if (res.status === 401 || res.status === 403) {
            notifyAuthFailure(res.status, `/replicate/${name}/pull`);
          }
          const message =
            json?.error ||
            `No se pudo sincronizar con el servidor (HTTP ${res.status})`;
          reportServerError({
            collection: name,
            direction: "pull",
            timestamp: new Date().toISOString(),
            message,
            status: res.status,
            statusText: res.statusText,
            requestUrl,
            requestBody,
            responseBody: text,
          });
          throw new ServerError(message);
        }
        const documents = name === "products"
          ? json.documents.map((document: any) => ({
              ...document,
              catalogVersion: Number(document.catalogVersion) || 1,
            }))
          : json.documents;
        return {
          documents,
          checkpoint: json.checkpoint ?? null,
        };
      },
    },
  });
  activeReplications.push(replication);
  traceDatabase("replication:pull:started", { name });
  return replication;
}

function startPushReplication(collection: RxCollection<any>) {
  traceDatabase("replication:push:start", { name: "sales", db: collection.database.name });
  const replication = replicateRxCollection({
    collection,
    replicationIdentifier: "push-server",
    live: true,
    retryTime: 5000,
    deletedField: "_deleted",
    push: {
      modifier: async (doc: any) => doc.syncStatus === "pending" ? doc : null,
      handler: async (documents: any[]) => {
        traceDatabase("replication:push:handler", { count: documents.length });
        let batchFailed = false;

        for (const doc of documents) {
          const docData = doc.newDocumentState ?? doc;
          const ok = await pushSaleDocument(collection, docData);
          if (!ok) batchFailed = true;
        }

        // Throwing makes RxDB retry the whole batch after retryTime instead of
        // marking the failed documents as successfully pushed.
        if (batchFailed) {
          traceDatabase("replication:push:failed", { count: documents.length });
          throw new ServerError("Error de sincronización con el servidor");
        }
        traceDatabase("replication:push:done", { count: documents.length });
        return [];
      },
    },
  });
  activeReplications.push(replication);
  traceDatabase("replication:push:started", { name: "sales" });
  return replication;
}

export async function resetDatabase() {
  traceDatabase("reset:start", { hasPromise: Boolean(databaseRuntime.promise), closing: databaseClosing });
  const db = await databaseRuntime.promise?.catch(() => null);
  const pendingSales = db && !databaseClosing
    ? await db.sales.find({ selector: { syncStatus: "pending" }, limit: 1 }).exec()
    : [];
  if (pendingSales.length > 0) {
    traceDatabase("reset:blocked-pending-sales", { count: pendingSales.length });
    throw new Error("Hay ventas pendientes de sincronización");
  }

  try {
    databaseClosing = true;
    traceDatabase("reset:closing:start", { db: db?.name });
    if (pendingRetryTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(pendingRetryTimer);
      pendingRetryTimer = null;
    }
    if (typeof window !== "undefined" && retryHandler) {
      window.removeEventListener("online", retryHandler);
      window.removeEventListener("focus", retryHandler);
      retryHandler = null;
    }
    await Promise.all(activeReplications.splice(0).map((replication) => replication.cancel()));
    traceDatabase("reset:replications-cancelled");
    await pendingRetryInFlight;
    traceDatabase("reset:retry-finished");
    await Promise.all(pendingPushes.values());
    traceDatabase("reset:pushes-finished");
    await db?.close();
    traceDatabase("reset:db-closed");
    databaseRuntime.promise = null;
    await removeRxDatabase(DB_NAME, getRxStorageDexie());
    traceDatabase("reset:removed", { name: DB_NAME });
  } catch (e) {
    databaseClosing = false;
    traceDatabase("reset:error", e);
    console.warn("Error resetting database:", e);
    throw e;
  }
}

export async function downloadDatabaseBackup() {
  const db = await getDatabase();
  const dump = await db.exportJSON();
  const blob = new Blob([JSON.stringify(dump, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `pos-local-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const getDatabase = (): Promise<RxDatabase<RxCollections>> => {
  traceDatabase("getDatabase:called", {
    hasPromise: Boolean(databaseRuntime.promise),
    closing: databaseClosing,
  });
  if (!databaseRuntime.promise) {
    traceDatabase("getDatabase:create-promise");
    databaseRuntime.promise = getDatabaseInner().catch((e) => {
      traceDatabase("getDatabase:promise-error", e);
      databaseRuntime.promise = null;
      throw e;
    });
  }
  traceDatabase("getDatabase:return", { hasPromise: Boolean(databaseRuntime.promise) });
  return databaseRuntime.promise;
};
