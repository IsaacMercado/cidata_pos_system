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
  version: 2,
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

const DB_NAME = "pos_offline";

type DatabaseRuntime = { promise: Promise<RxDatabase<RxCollections>> | null };
const databaseRuntime = ((globalThis as typeof globalThis & {
  __posDatabaseRuntime?: DatabaseRuntime;
}).__posDatabaseRuntime ??= { promise: null });

function makeStorage() {
  return wrappedValidateAjvStorage({ storage: getRxStorageDexie() });
}

const createDatabase = async (): Promise<RxDatabase<RxCollections>> => {
  if (import.meta.env.DEV) {
    addRxPlugin(RxDBDevModePlugin);
  }

  const db = await createRxDatabase<RxCollections>({
    name: DB_NAME,
    storage: makeStorage(),
    multiInstance: true,
    eventReduce: true,
    // ignoreDuplicate only works in dev-mode (throws DB9 in prod). closeDuplicates
    // closes pre-existing instances and is allowed in production.
    ...(import.meta.env.DEV ? { ignoreDuplicate: true } : { closeDuplicates: true }),
  });

  await db.addCollections({
    products: {
      schema: productSchema,
      migrationStrategies: {
        1: (doc: ProductDoc) => ({
          ...doc,
          variantGroupId: doc.variantGroupId ?? null,
          variantAttributes: doc.variantAttributes ?? [],
          variantValues: doc.variantValues ?? {},
        }),
        2: (doc: ProductDoc) => ({
          ...doc,
          reservationRates: doc.reservationRates ?? [],
        }),
      },
    },
    restaurants: { schema: restaurantSchema },
    restaurant_tables: { schema: restaurantTableSchema },
    operators: {
      schema: operatorSchema,
      migrationStrategies: { 1: (doc: any) => { delete doc.pinHash; return doc; } },
    },
    sales: {
      schema: saleSchema,
      migrationStrategies: {
        1: (doc: any) => ({
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
        }),
      },
    },
  });

  startReplication(db.products, "products");
  startReplication(db.restaurants, "restaurants");
  startReplication(db.restaurant_tables, "restaurant_tables");
  startReplication(db.operators, "operators");
  startPushReplication(db.sales);
  startPendingSalesRetry(db.sales);

  return db;
};

const getDatabaseInner = async (): Promise<RxDatabase<RxCollections>> => {
  return createDatabase();
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
const pendingPushes = new Map<string, Promise<boolean>>();
let pendingRetryTimer: number | null = null;

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

// Shows a toast (with a download button) for a server-side error. Network
// timeouts are not reported here, only real server responses with errors.
function reportServerError(info: SyncErrorInfo) {
  const now = Date.now();
  const key = `${info.direction}:${info.collection}:${info.message}`;
  const last = lastServerErrorAt.get(key) ?? 0;
  if (now - last >= SERVER_ERROR_COOLDOWN_MS) {
    lastServerErrorAt.set(key, now);
    console.error("RxDB replication server error", info);
    emitToast(
      info.message,
      "error",
      { label: "Descargar", onClick: () => downloadErrorLog(info) },
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
  const key = docData.clientId || docData.rxid;
  const running = pendingPushes.get(key);
  if (running) return running;

  const promise = (async () => {
    const requestUrl = `${API_BASE}/replicate/sales/push`;
    const body = buildPushBody(docData);
    const requestBody = JSON.stringify(body, null, 2);
    const session = loadSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.token) headers.Authorization = `Bearer ${session.token}`;

    try {
      const res = await fetch(requestUrl, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(body),
      });
      const { text, json } = await readResponse(res);
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
        await target.incrementalPatch({
          serverId: json.serverId ?? null,
          receiptNumber: json.receiptNumber ?? target.receiptNumber,
          syncStatus: "synced",
          updatedAt: new Date().toISOString(),
        });
      }
      return true;
    } catch (error) {
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
    return await promise;
  } finally {
    pendingPushes.delete(key);
  }
}

async function retryPendingSales(collection: RxCollection<any>) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (typeof navigator !== "undefined" && navigator.onLine && !loadSession()?.token) return;
  const pending = await collection
    .find({ selector: { syncStatus: "pending" }, sort: [{ createdAt: "asc" }] })
    .exec();
  for (const document of pending) {
    await pushSaleDocument(collection, document.toJSON(), document);
  }
}

function startPendingSalesRetry(collection: RxCollection<any>) {
  if (typeof window === "undefined") return;
  const retry = async () => {
    await retryPendingSales(collection).catch((error) => console.error("Pending sales retry failed", error));
    pendingRetryTimer = window.setTimeout(retry, 15_000);
  };
  if (pendingRetryTimer !== null) window.clearTimeout(pendingRetryTimer);
  pendingRetryTimer = window.setTimeout(retry, 1_000);
  window.addEventListener("online", retry);
  window.addEventListener("focus", retry);
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
  return replicateRxCollection({
    collection,
    replicationIdentifier: "server",
    live: true,
    retryTime: 5000,
    deletedField: "_deleted",
    pull: {
      async handler(checkpoint: any, batchSize: number) {
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
        return {
          documents: json.documents,
          checkpoint: json.checkpoint ?? null,
        };
      },
    },
  });
}

function startPushReplication(collection: RxCollection<any>) {
  return replicateRxCollection({
    collection,
    replicationIdentifier: "push-server",
    live: true,
    retryTime: 5000,
    deletedField: "_deleted",
    push: {
      modifier: async (doc: any) => doc.syncStatus === "pending" ? doc : null,
      handler: async (documents: any[]) => {
        let batchFailed = false;

        for (const doc of documents) {
          const docData = doc.newDocumentState ?? doc;
          const ok = await pushSaleDocument(collection, docData);
          if (!ok) batchFailed = true;
        }

        // Throwing makes RxDB retry the whole batch after retryTime instead of
        // marking the failed documents as successfully pushed.
        if (batchFailed) {
          throw new ServerError("Error de sincronización con el servidor");
        }
        return [];
      },
    },
  });
}

export async function resetDatabase() {
  const db = await databaseRuntime.promise?.catch(() => null);
  const pendingSales = db
    ? await db.sales.find({ selector: { syncStatus: "pending" }, limit: 1 }).exec()
    : [];
  if (pendingSales.length > 0) {
    throw new Error("Hay ventas pendientes de sincronización");
  }

  try {
    await db?.close();
    databaseRuntime.promise = null;
    await removeRxDatabase(DB_NAME, getRxStorageDexie());
  } catch (e) {
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
  if (!databaseRuntime.promise) {
    databaseRuntime.promise = getDatabaseInner().catch((e) => {
      databaseRuntime.promise = null;
      throw e;
    });
  }
  return databaseRuntime.promise;
};
