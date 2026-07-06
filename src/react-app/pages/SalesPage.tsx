import { useState, useEffect } from "preact/hooks";
import { api } from "../lib/api";
import { ReceiptModal } from "../components/pos/ReceiptModal";
import { useToast } from "../components/pos/Toast";
const METHOD_LABEL: Record<number, string> = {
  1: "💰 Efectivo",
  2: "💳 Tarjeta",
  3: "🏦 Transferencia",
  4: "📱 Pago Móvil",
};

export function SalesPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptSale, setReceiptSale] = useState<any | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const { toast } = useToast();

  async function load() {
    const data = await api.sales.list();
    setSales(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function showDetail(id: number) {
    setDetailId(id);
    try {
      const data = await api.sales.get(id);
      setDetail(data);
    } catch {
      toast("Error al cargar detalle", "error");
    }
  }

  async function cancelSale(id: number) {
    try {
      await api.sales.cancel(id);
      toast("Venta cancelada", "success");
      setDetail(null);
      setDetailId(null);
      await load();
    } catch {
      toast("Error al cancelar", "error");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 py-12">
        <div className="animate-pulse text-sm">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-zinc-800 mb-6 flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center text-white text-xs">≡</span>
        Historial de Ventas
      </h1>

      <div className="overflow-hidden border border-zinc-200 rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 text-left">
                <th className="px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Recibo</th>
                <th className="px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Fecha</th>
                <th className="px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider hidden sm:table-cell">Productos</th>
                <th className="px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider text-right">Total</th>
                <th className="px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale: any) => (
                <tr key={sale.id} className={`border-t border-zinc-100 hover:bg-indigo-50/30 transition-colors cursor-pointer ${detailId === sale.id ? "bg-indigo-50/60" : ""}`} onClick={() => showDetail(sale.id)}>
                  <td className="px-4 py-3 font-medium text-zinc-800">{sale.receipt_number}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
{new Date(sale.createdAt).toLocaleDateString()}{" "}
            <span className="text-zinc-300">
              {new Date(sale.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 hidden sm:table-cell">{sale.items?.length ?? 0} artículos</td>
                  <td className="px-4 py-3 text-right font-semibold text-zinc-800">${sale.total.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      sale.status === "completed"
                        ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                        : sale.status === "cancelled"
                        ? "text-red-600 bg-red-50 border border-red-200"
                        : "text-amber-600 bg-amber-50 border border-amber-200"
                    }`}>
                      {sale.status === "completed" ? "Completada" : sale.status === "cancelled" ? "Cancelada" : sale.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {sale.status === "completed" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); cancelSale(sale.id); }}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-400">No hay ventas registradas</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {detail && (
        <dialog
          open
          className="rounded-2xl shadow-2xl border border-zinc-200 p-0 backdrop:bg-black/30 w-full max-w-lg m-auto"
          onClick={() => { setDetail(null); setDetailId(null); }}
        >
          <div className="p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-800">Detalle de Venta</h2>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                detail.status === "completed"
                  ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                  : "text-red-600 bg-red-50 border border-red-200"
              }`}>
                {detail.status === "completed" ? "Completada" : "Cancelada"}
              </span>
            </div>

            <p className="text-xs text-zinc-400">Recibo: {detail.receipt_number}</p>
            <p className="text-xs text-zinc-400">
              {new Date(detail.createdAt).toLocaleString()}
            </p>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-400 text-xs uppercase">
                  <th className="text-left font-medium pb-1">Producto</th>
                  <th className="text-center font-medium pb-1">Cant</th>
                  <th className="text-right font-medium pb-1">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(detail.items || []).map((item: any) => (
                  <tr key={item.id} className="border-t border-zinc-100">
                    <td className="py-1.5 text-zinc-800">{item.name || `#${item.productId}`}</td>
                    <td className="py-1.5 text-center text-zinc-600">{item.quantity}</td>
                    <td className="py-1.5 text-right font-medium">${item.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-zinc-200 pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-zinc-500">
                <span>Subtotal</span>
                <span>${detail.subtotal?.toFixed(2)}</span>
              </div>
              {(detail.payments || []).map((p: any) => (
                <div key={p.id} className="flex justify-between text-zinc-500">
                  <span>{METHOD_LABEL[p.paymentMethodId] || `Método #${p.paymentMethodId}`}</span>
                  <span>${p.amount.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between text-base font-bold text-zinc-800 pt-1 border-t border-zinc-100">
                <span>Total</span>
                <span>${detail.total?.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {detail.status === "completed" && (
                <button
                  onClick={() => { setReceiptSale(detail); }}
                  className="flex-1 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors"
                >
                  Imprimir
                </button>
              )}
              <button
                onClick={() => { setDetail(null); setDetailId(null); }}
                className="flex-1 py-2.5 bg-zinc-100 text-zinc-600 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </dialog>
      )}

      {receiptSale && <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} />}
    </div>
  );
}
