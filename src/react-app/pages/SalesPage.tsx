import { Banknote, Building, CreditCard, Receipt, Smartphone } from "lucide-react";
import { useEffect, useState } from "preact/hooks";
import { ReceiptModal } from "../components/pos/ReceiptModal";
import { useToast } from "../components/pos/Toast";
import { Badge, Button, Loading, Modal, PageHeader, Table } from "../components/ui";
import { api } from "../lib/api";
import type { SaleWithItems } from "../lib/types";

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

  if (loading) return <Loading text="Cargando..." />;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <PageHeader title="Historial de Ventas" icon={Receipt} />

      <Table>
        <Table.Head>
          <Table.Row>
            <Table.Header>Recibo</Table.Header>
            <Table.Header>Fecha</Table.Header>
            <Table.Header className="hidden sm:table-cell">Productos</Table.Header>
            <Table.Header className="text-right">Total</Table.Header>
            <Table.Header>Estado</Table.Header>
            <Table.Header>Acciones</Table.Header>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {sales.map((sale) => (
            <Table.Row key={sale.id} className={`cursor-pointer ${detailId === sale.id ? "bg-indigo-50/60" : ""}`} onClick={() => showDetail(sale.id)}>
              <Table.Cell className="font-medium text-zinc-800">{sale.receiptNumber}</Table.Cell>
              <Table.Cell className="text-xs text-zinc-500 whitespace-nowrap">
                {new Date(sale.createdAt).toLocaleDateString()}{" "}
                <span className="text-zinc-300">
                  {new Date(sale.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </Table.Cell>
              <Table.Cell className="text-zinc-500 hidden sm:table-cell">{sale.items?.length ?? 0} artículos</Table.Cell>
              <Table.Cell className="text-right font-semibold text-zinc-800">${sale.total.toFixed(2)}</Table.Cell>
              <Table.Cell>
                <Badge variant={sale.status === "completed" ? "success" : sale.status === "cancelled" ? "danger" : "warning"}>
                  {sale.status === "completed" ? "Completada" : sale.status === "cancelled" ? "Cancelada" : sale.status}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                {(sale.status === "completed" || sale.status === "in_progress") && (
                  <button
                    onClick={(e) => { e.stopPropagation(); cancelSale(sale.id); }}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    {sale.status === "in_progress" ? "Cancelar orden" : "Cancelar"}
                  </button>
                )}
              </Table.Cell>
            </Table.Row>
          ))}
          {sales.length === 0 && <Table.Empty colSpan={6}>No hay ventas registradas</Table.Empty>}
        </Table.Body>
      </Table>

      <Modal open={!!detail} onClose={() => { setDetail(null); setDetailId(null); }} size="lg" className="max-w-lg p-0">
        {detail && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-800">Detalle de Venta</h2>
              <Badge variant={detail.status === "completed" ? "success" : "danger"}>
                {detail.status === "completed" ? "Completada" : "Cancelada"}
              </Badge>
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
                <Button variant="dark" className="flex-1" onClick={() => { setReceiptSale(detail); }}>
                  Imprimir
                </Button>
              )}
              <Button variant="light" className="flex-1" onClick={() => { setDetail(null); setDetailId(null); }}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {receiptSale && <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} />}
    </div>
  );
}
