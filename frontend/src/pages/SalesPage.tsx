import { useState, useEffect } from "preact/hooks";
import { api } from "../lib/api";
import { getCachedSales, cacheSale } from "../lib/db";
import { useOnlineStatus } from "../lib/useOnlineStatus";

const statusStyle: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
};

export function SalesPage() {
  const [list, setList] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const online = useOnlineStatus();

  useEffect(() => { load(); }, []);

  async function load() {
    if (online) {
      try {
        const data = await api.sales.list({ limit: 100 });
        for (const s of data) await cacheSale(s);
        setList(data);
        return;
      } catch {}
    }
    setList(await getCachedSales());
  }

  async function cancel(id: number) {
    if (!online || !confirm("¿Anular esta venta?")) return;
    await api.sales.cancel(id);
    await load();
  }

  async function showDetail(id: number) {
    if (online) {
      const sale = await api.sales.get(id);
      setSelected(sale);
    }
  }

  if (selected) {
    return (
      <div>
        <button className="mb-3 flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700" onClick={() => setSelected(null)}>
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Volver
        </button>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold text-base">Venta {selected.receiptNumber}</h3>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle[selected.status] || "bg-slate-100 text-slate-600"}`}>
              {selected.status}
            </span>
          </div>
          <div className="mb-2 text-xs text-slate-400">{new Date(selected.createdAt).toLocaleString()}</div>
          <div className="text-sm">Total: <strong className="text-base">${selected.total.toFixed(2)}</strong></div>
          {selected.items && selected.items.length > 0 && (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[0.65rem] font-semibold uppercase text-slate-500">
                  <th className="pb-1 pr-2">Producto</th>
                  <th className="pb-1 pr-2">Cant</th>
                  <th className="pb-1 pr-2">Precio</th>
                  <th className="pb-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((i: any) => (
                  <tr key={i.id} className="border-b border-slate-50">
                    <td className="py-1 pr-2">{i.productId}</td>
                    <td className="py-1 pr-2">{i.quantity}</td>
                    <td className="py-1 pr-2">${i.unitPrice.toFixed(2)}</td>
                    <td className="py-1 text-right">${i.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Ventas</h2>
        <button className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white transition" onClick={load}>
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Recargar
        </button>
      </div>

      <div className="space-y-2">
        {list.map((s: any) => (
          <div
            key={s.id}
            className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md"
            onClick={() => showDetail(s.id)}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">{s.receiptNumber}</div>
                <div className="text-xs text-slate-400">{new Date(s.createdAt).toLocaleDateString()}</div>
              </div>
              <div className="text-right">
                <div className="font-bold">${s.total.toFixed(2)}</div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${statusStyle[s.status] || "bg-slate-100 text-slate-600"}`}>
                  {s.status === "in_progress" ? "En mesa" : s.status}
                </span>
              </div>
            </div>
            {s.status === "completed" && (
              <button
                className="mt-2 rounded px-2 py-0.5 text-xs font-medium text-red-500 hover:bg-red-50 transition"
                onClick={(e) => { e.stopPropagation(); cancel(s.id); }}
              >
                Anular
              </button>
            )}
          </div>
        ))}
        {list.length === 0 && <div className="py-10 text-center text-sm text-slate-400">No hay ventas</div>}
      </div>
    </div>
  );
}
