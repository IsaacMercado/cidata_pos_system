import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { useState } from "preact/hooks";
import { ReceiptModal } from "../components/pos/ReceiptModal";
import { useToast } from "../components/pos/Toast";
import { Badge, Button, Card, CardTitle, Dialog, Loading, PageHeader, Table } from "../components/ui";
import { api } from "../lib/api";
import { METHOD_ICON, METHOD_LABEL } from "../lib/paymentMethods";
import type { SaleWithItems } from "../lib/types";

export function SalesPage() {
  const [receiptSale, setReceiptSale] = useState<SaleWithItems | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SaleWithItems | null>(null);
  const { toast } = useToast();

  const queryClient = useQueryClient();

  const { data: salesData, isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: () => api.sales.list(),
  });

  const cancelSaleMutation = useMutation({
    mutationFn: (id: number) => api.sales.cancel(id),
    onSuccess: () => {
      toast("Venta cancelada", "success");
      setDetail(null);
      setDetailId(null);
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: () => {
      toast("Error al cancelar", "error");
    },
  });

  async function showDetail(id: number) {
    setDetailId(id);
    try {
      const data = await api.sales.get(id);
      setDetail(data);
    } catch {
      toast("Error al cargar detalle", "error");
    }
  }

  if (isLoading) return <Loading text="Cargando..." />;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <PageHeader title="Historial de Ventas" icon={Receipt} />

      <Card>
        <Table>
          <Table.Head>
            <Table.Row>
              <Table.Header>Recibo</Table.Header>
              <Table.Header>Fecha</Table.Header>
              <Table.Header className="text-right">Total</Table.Header>
              <Table.Header>Estado</Table.Header>
              <Table.Header>Acciones</Table.Header>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {salesData?.map((sale) => (
              <Table.Row key={sale.id} className={`cursor-pointer ${detailId === sale.id ? "bg-primary-50/60" : ""}`} onClick={() => showDetail(sale.id)}>
                <Table.Cell className="font-medium text-zinc-800">{sale.receiptNumber}</Table.Cell>
                <Table.Cell className="text-xs text-zinc-500 whitespace-nowrap">
                  {(() => {
                    const d = new Date(sale.createdAt.replace(" ", "T") + "Z");
                    return Number.isNaN(d.getTime()) ? sale.createdAt : d.toLocaleDateString();
                  })()}{" "}
                  <span className="text-zinc-300">
                    {(() => {
                      const d = new Date(sale.createdAt.replace(" ", "T") + "Z");
                      return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                    })()}
                  </span>
                </Table.Cell>
                <Table.Cell className="text-right font-semibold text-zinc-800">${sale.total.toFixed(2)}</Table.Cell>
                <Table.Cell>
                  <Badge variant={sale.status === "completed" ? "success" : sale.status === "cancelled" ? "danger" : "warning"}>
                    {sale.status === "completed" ? "Completada" : sale.status === "cancelled" ? "Cancelada" : sale.status}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  {(sale.status === "completed" || sale.status === "in_progress") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelSaleMutation.mutate(sale.id);
                      }}
                    >
                      {sale.status === "in_progress" ? "Cancelar orden" : "Cancelar"}
                    </Button>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
            {salesData?.length === 0 && <Table.Empty colSpan={5}>No hay ventas registradas</Table.Empty>}
          </Table.Body>
        </Table>
      </Card>

      <Dialog open={!!detail} onClose={() => { setDetail(null); setDetailId(null); }} size="lg" className="max-w-lg p-0">
        {detail && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle>Detalle de Venta</CardTitle>
              <Badge variant={detail.status === "completed" ? "success" : "danger"}>
                {detail.status === "completed" ? "Completada" : "Cancelada"}
              </Badge>
            </div>

            <p className="text-xs text-zinc-400">Recibo: {detail.receiptNumber}</p>
            <p className="text-xs text-zinc-400">
              {(() => {
                const raw = detail.createdAt;
                if (!raw) return "";
                const d = new Date(raw.replace(" ", "T") + "Z");
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
                    <td className="py-1.5 text-zinc-800">{(item as any).name || `#${item.productId}`}</td>
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
              {(detail.taxTotal ?? 0) > 0 && (
                <div className="flex justify-between text-zinc-500">
                  <span>IVA ({((detail.taxTotal / (detail.subtotal || 1)) * 100).toFixed(1)}%)</span>
                  <span>${(detail.taxTotal ?? 0).toFixed(2)}</span>
                </div>
              )}
              {(detail.payments || []).map((p) => {
                const Icon = METHOD_ICON[p.paymentMethodId];
                const isMobile = p.paymentMethodId === 4;
                return (
                  <div key={p.id}>
                    <div className="flex justify-between text-zinc-500">
                      <span className="flex items-center gap-1.5">
                        {Icon && <Icon size={14} />}
                        {METHOD_LABEL[p.paymentMethodId] || `Método #${p.paymentMethodId}`}
                      </span>
                      <span>${p.amount.toFixed(2)}</span>
                    </div>
                    {isMobile && (p.reference || p.phone) && (
                      <div className="text-xs text-zinc-400 pl-5 mt-0.5 leading-tight">
                        {p.reference && <div>Ref: {p.reference}</div>}
                        {p.phone && <div>Tel: {p.phone}</div>}
                      </div>
                    )}
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
      </Dialog>

      {receiptSale && <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} />}
    </div>
  );
}
