import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Package, Plus, X as XIcon } from "lucide-react";
import { useState } from "preact/hooks";
import { useToast } from "../components/pos/Toast";
import { Badge, Button, Card, CardTitle, Dialog, DialogClose, Input, Loading, PageHeader, Select, Table } from "../components/ui";
import { api } from "../lib/api";

export function PurchaseOrdersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [viewOrder, setViewOrder] = useState<any | null>(null);
  const queryClient = useQueryClient();

  const { isLoading: loading, data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.purchases.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.products.list(),
  });

  if (loading) return <Loading text="Cargando..." />;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Órdenes de Compra"
        icon={Package}
        action={
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Nueva Recepción
          </Button>
        }
      />

      <Card>
        <Table>
          <Table.Head>
            <Table.Row>
              <Table.Header>N° Recepción</Table.Header>
              <Table.Header className="text-right">Items</Table.Header>
              <Table.Header className="text-center">Estado</Table.Header>
              <Table.Header className="text-right">Fecha</Table.Header>
              <Table.Header className="text-right">Acción</Table.Header>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {orders?.length === 0 ? (
              <Table.Empty colSpan={5}>No hay órdenes de compra</Table.Empty>
            ) : orders?.map((o: any) => (
              <Table.Row key={o.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <Table.Cell className="font-medium text-neutral-900 dark:text-neutral-100">{o.receiptNumber}</Table.Cell>
                <Table.Cell className="text-right text-neutral-500 dark:text-neutral-400">{o.totalItems}</Table.Cell>
                <Table.Cell className="text-center">
                  <Badge variant="success">{o.status}</Badge>
                </Table.Cell>
                <Table.Cell className="text-right text-neutral-400 text-xs">{o.createdAt}</Table.Cell>
                <Table.Cell className="text-right">
                  <Button size="sm" variant="ghost" onClick={async () => {
                    const detail = await api.purchases.get(o.id);
                    setViewOrder(detail);
                  }}>
                    <Eye size={14} /> Ver
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Card>

      <Dialog open={showCreate} onClose={() => setShowCreate(false)} size="lg">
        <CreatePurchaseOrder
          products={products}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ['orders'] });
          }}
        />
      </Dialog>

      <Dialog open={!!viewOrder} onClose={() => setViewOrder(null)} size="lg">
        {viewOrder && (
          <ViewPurchaseOrder
            order={viewOrder}
            onClose={() => setViewOrder(null)}
          />
        )}
      </Dialog>
    </div>
  );
}

function CreatePurchaseOrder({ products, onClose, onCreated }: {
  products: any[];
  onClose: () => void;
  onCreated: () => void
}) {
  const [items, setItems] = useState<{ productId: number; quantity: number; unitCost: number }[]>([
    { productId: 0, quantity: 1, unitCost: 0 },
  ]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const activeProducts = (products || []).filter((p: any) => p.isActive);

  const addItem = () => setItems([...items, { productId: 0, quantity: 1, unitCost: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: any) => {
    const copy = [...items];
    (copy[i] as any)[field] = value;
    setItems(copy);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");

    if (items.some((it) => !it.productId)) {
      setError("Todos los items deben tener un producto seleccionado");
      return;
    }
    if (items.some((it) => it.quantity <= 0)) {
      setError("Todas las cantidades deben ser mayores a 0");
      return;
    }

    setSaving(true);
    try {
      await api.purchases.create({ notes: notes || undefined, items });
      toast("Recepción registrada exitosamente", "success");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear orden");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-700">
        <CardTitle>Nueva Recepción</CardTitle>
        <DialogClose onClose={onClose}><XIcon size={20} /></DialogClose>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Producto</label>
                <Select
                  value={item.productId || ""}
                  onChange={(e) => updateItem(i, "productId", parseInt((e.target as HTMLSelectElement).value))}
                  options={[
                    { value: "", label: "Seleccionar..." },
                    ...activeProducts.map((p: any) => ({ value: String(p.id), label: `${p.name} (${p.code})` }))
                  ]}
                />
              </div>
              <div className="w-24">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Cant.</label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, "quantity", parseFloat((e.target as HTMLInputElement).value) || 0)}
                />
              </div>
              <div className="w-28">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Costo U.</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitCost}
                  onChange={(e) => updateItem(i, "unitCost", parseFloat((e.target as HTMLInputElement).value) || 0)}
                />
              </div>
              {items.length > 1 && (
                <DialogClose onClose={() => removeItem(i)} className="flex items-center h-10 text-red-400 hover:text-red-300">
                  <XIcon size={16} />
                </DialogClose>
              )}
            </div>
          ))}
        </div>

        <Button type="button" variant="ghost" size="sm" onClick={addItem} className="w-full">
          <Plus size={14} className="mr-1" /> Agregar otro producto
        </Button>

        <Input
          placeholder="Notas (opcional)"
          value={notes}
          onChange={(e) => setNotes((e.target as HTMLInputElement).value)}
          label="Notas (opcional)"
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}

        <div className="flex gap-2 justify-end pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <DialogClose onClose={onClose}>Cancelar</DialogClose>
          <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Registrar Recepción"}</Button>
        </div>
      </form>
    </div>
  );
}

function ViewPurchaseOrder({ order, onClose }: { order: any; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-700">
        <CardTitle>{order.receiptNumber}</CardTitle>
        <DialogClose onClose={onClose}><XIcon size={20} /></DialogClose>
      </div>

      <p className="text-sm text-neutral-400">
        {order.notes && <span className="block">{order.notes}</span>}
        <span className="text-xs">{order.createdAt}</span>
      </p>

      <Table>
        <Table.Head>
          <Table.Row>
            <Table.Header>Producto</Table.Header>
            <Table.Header className="text-right">Cant.</Table.Header>
            <Table.Header className="text-right">Costo U.</Table.Header>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {order.items?.map((item: any) => (
            <Table.Row key={item.id}>
              <Table.Cell className="text-neutral-900 dark:text-neutral-100">
                <div className="font-medium">{item.productName}</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">{item.productCode}</div>
              </Table.Cell>
              <Table.Cell className="text-right text-neutral-500 dark:text-neutral-400">{item.quantity}</Table.Cell>
              <Table.Cell className="text-right text-neutral-500 dark:text-neutral-400">${(item.unitCost ?? 0).toFixed(2)}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      <div className="flex justify-end pt-4 border-t border-neutral-200 dark:border-neutral-700">
        <Button onClick={onClose}>Cerrar</Button>
      </div>
    </div>
  );
}
