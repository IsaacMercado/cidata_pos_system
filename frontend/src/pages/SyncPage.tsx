import { useState, useEffect } from "preact/hooks";
import { fullSync, processPendingOps, refreshCatalog, isOnline } from "../lib/sync";
import { getPendingCount, getSyncMeta } from "../lib/db";
import { useOnlineStatus } from "../lib/useOnlineStatus";

export function SyncPage() {
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const online = useOnlineStatus();

  useEffect(() => { updateInfo(); }, []);

  async function updateInfo() {
    setPendingCount(await getPendingCount());
    const meta = await getSyncMeta("catalog");
    setLastSync(meta?.lastSyncAt || null);
  }

  async function doSync() {
    setSyncing(true);
    setStatus("Sincronizando...");
    setResult(null);

    try {
      const res = await fullSync((s) => setStatus(s.message));
      setResult(res);
      setStatus("Completado");
      await updateInfo();
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    }

    setSyncing(false);
  }

  async function doProcess() {
    setSyncing(true);
    const res = await processPendingOps((s) => setStatus(s.message));
    setResult({ pending: res, catalog: { productsCount: 0, customersCount: 0 } });
    setStatus(`${res.success} exitosos, ${res.failed} fallidos`);
    await updateInfo();
    setSyncing(false);
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold text-slate-800">Sincronización</h2>

      <div className="mb-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between py-1">
          <span className="text-sm text-slate-600">Estado</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
            online ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
          }`}>
            {online ? "En línea" : "Fuera de línea"}
          </span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-sm text-slate-600">Pendientes</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
            pendingCount > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
          }`}>
            {pendingCount} operaciones
          </span>
        </div>
        {lastSync && (
          <div className="mt-2 text-xs text-slate-400">
            Última sync: {new Date(lastSync).toLocaleString()}
          </div>
        )}
      </div>

      <div className="mb-3 space-y-2">
        <button
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white transition active:scale-95 disabled:opacity-50 hover:bg-blue-700"
          onClick={doSync}
          disabled={syncing || !online}
        >
          {syncing ? status : "Sincronizar ahora"}
        </button>
        <button
          className="w-full rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-600 transition active:scale-95 disabled:opacity-50 hover:bg-blue-50"
          onClick={doProcess}
          disabled={syncing || pendingCount === 0}
        >
          Procesar pendientes ({pendingCount})
        </button>
        <button
          className="w-full rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-600 transition active:scale-95 disabled:opacity-50 hover:bg-blue-50"
          onClick={async () => {
            setSyncing(true);
            setStatus("Actualizando catálogo...");
            const res = await refreshCatalog((s) => setStatus(s.message));
            setResult({ pending: { success: 0, failed: 0 }, catalog: res });
            setStatus("Catálogo actualizado");
            await updateInfo();
            setSyncing(false);
          }}
          disabled={syncing || !online}
        >
          Actualizar catálogo
        </button>
      </div>

      {status && !syncing && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm font-semibold text-slate-700">{status}</div>
          {result && (
            <div className="space-y-0.5 text-xs text-slate-500">
              <div>→ Ventas/productos enviados: {result.pending?.success ?? 0}</div>
              <div>→ Errores: {result.pending?.failed ?? 0}</div>
              <div>→ Productos descargados: {result.catalog?.productsCount ?? 0}</div>
              <div>→ Clientes descargados: {result.catalog?.customersCount ?? 0}</div>
            </div>
          )}
        </div>
      )}

      {syncing && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mb-2 text-2xl">⏳</div>
          <div className="text-sm text-slate-600">{status}</div>
        </div>
      )}

      <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 text-xs leading-relaxed text-slate-400">
        <strong className="font-semibold text-slate-500">Offline-first:</strong> Las ventas se guardan localmente aunque no haya conexión.
        Cuando vuelvas a estar en línea, pulsa "Sincronizar ahora" para enviarlas.
      </div>
    </div>
  );
}
