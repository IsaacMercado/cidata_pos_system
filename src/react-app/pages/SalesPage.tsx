import { useState, useEffect } from "preact/hooks";
import { api } from "../lib/api";
import { ReceiptModal } from "../components/pos/ReceiptModal";
import { useToast } from "../components/pos/Toast";
import type { SaleWithItems } from "../lib/types";
import { Receipt, Banknote, CreditCard, Building, Smartphone } from "lucide-react";

const METHOD_ICON: Record<number, typeof Banknote> = {
  1: Banknote,
  2: CreditCard,
  3: Building,
  4: Smartphone,
};
const METHOD_LABEL: Record<number, string> = {
  1: "Efectivo",
  2: "Tarjeta",
  3: "Transferencia",
  4: "Pago Móvil",
};

export function SalesPage() {
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptSale, setReceiptSale] = useState<SaleWithItems | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SaleWithItems | null>(null);
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
        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center text-white">
          <Receipt size={14} />
        </span>
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
              {sales.map((sale) => (
                <tr key={sale.id} className={`border-t border-zinc-100 hover:bg-indigo-50/30 transition-colors cursor-pointer ${detailId === sale.id ? "bg-indigo-50/60" : ""}`} onClick={() => showDetail(sale.id)}>
                  <td className="px-4 py-3 font-medium text-zinc-800">{sale.receiptNumber}</td>
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

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3"
          onClick={() => { setDetail(null); setDetailId(null); }}
        >
          <dialog
            open
            className="rounded-2xl shadow-2xl border border-zinc-200 p-0 w-full max-w-lg bg-white max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
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

              <p className="text-xs text-zinc-400">Recibo: {detail.receiptNumber}</p>
              <p className="text-xs text-zinc-400">
                {(() => {
                  const raw = detail.createdAt;
                  if (!raw) return "";
                  const d = new Date(raw);
                  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
                })()}
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
                  {(detail.items || []).map((item) => (
                    <tr key={item.id} className="border-t border-zinc-100">
                      <td className="py-1.5 text-zinc-800">{item.product?.name || `#${item.productId}`}</td>
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
                {(detail.payments || []).map((p) => {
                  const Icon = METHOD_ICON[p.paymentMethodId];
                  return (
                    <div key={p.id} className="flex justify-between text-zinc-500">
                      <span className="flex items-center gap-1.5">
                        {Icon && <Icon size={14} />}
                        {METHOD_LABEL[p.paymentMethodId] || `Método #${p.paymentMethodId}`}
                      </span>
                      <span>${p.amount.toFixed(2)}</span>
                    </div>
                  );
                })}
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
        </div>
      )}

      {receiptSale && <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} />}
    </div>
  );
}
