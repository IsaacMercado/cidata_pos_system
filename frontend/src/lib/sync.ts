import { api } from "./api";
import {
  getPendingOps,
  removePendingOp,
  incrementRetry,
  cacheProducts,
  cacheCustomers,
  cacheSale,
  setSyncMeta,
} from "./db";

type SyncCallback = (status: { type: string; message: string }) => void;

export async function processPendingOps(onStatus?: SyncCallback) {
  const ops = await getPendingOps();
  let success = 0;
  let failed = 0;

  for (const op of ops) {
    try {
      onStatus?.({ type: "syncing", message: `Sincronizando ${op.type}...` });

      if (op.retries >= 3) {
        await removePendingOp(op.id!);
        failed++;
        continue;
      }

      switch (op.type) {
        case "create_sale": {
          const sale = await api.sales.create(op.payload);
          await cacheSale(sale);
          break;
        }
        case "create_customer": {
          await api.customers.create(op.payload);
          break;
        }
        case "update_product": {
          await api.products.update(op.payload.id, op.payload.data);
          break;
        }
      }

      await removePendingOp(op.id!);
      success++;
    } catch (e) {
      await incrementRetry(op.id!);
      failed++;
    }
  }

  return { success, failed };
}

export async function refreshCatalog(onStatus?: SyncCallback) {
  let productsCount = 0;
  let customersCount = 0;

  try {
    onStatus?.({ type: "syncing", message: "Descargando productos..." });
    const products = await api.products.list({});
    await cacheProducts(products);
    productsCount = products.length;
  } catch (e) {
    if (navigator.onLine) throw e;
  }

  try {
    onStatus?.({ type: "syncing", message: "Descargando clientes..." });
    const customers = await api.customers.list({});
    await cacheCustomers(customers);
    customersCount = customers.length;
  } catch (e) {
    if (navigator.onLine) throw e;
  }

  await setSyncMeta("catalog", { lastSyncAt: new Date().toISOString() });

  return { productsCount, customersCount };
}

export async function fullSync(onStatus?: SyncCallback) {
  onStatus?.({ type: "syncing", message: "Procesando operaciones pendientes..." });
  const pendingResult = await processPendingOps(onStatus);

  onStatus?.({ type: "syncing", message: "Actualizando catálogo..." });
  const catalogResult = await refreshCatalog(onStatus);

  onStatus?.({ type: "done", message: "Sincronización completada" });

  return {
    pending: pendingResult,
    catalog: catalogResult,
  };
}

export async function isOnline(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL || "/api"}/health`, {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
