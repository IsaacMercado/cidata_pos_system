import { useEffect, useState } from "preact/hooks";
import { api } from "../lib/api";
import { Button, Loading, PageHeader } from "../components/ui";
import { Package, Plus, Eye, X } from "lucide-react";
import { useToast } from "../components/pos/Toast";
export function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewOrder, setViewOrder] = useState<any | null>(null);
  void useToast();

  async function load() {
    try {
      const [ords, prods] = await Promise.all([
        api.purchases.list(),
        api.products.list(),
      ]);
      setOrders(ords);
      setProducts(prods);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

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

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              <th className="px-4 py-3 text-left text-slate-400 font-medium">N° Recepción</th>
              <th className="px-4 py-3 text-right text-slate-400 font-medium">Items</th>
              <th className="px-4 py-3 text-center text-slate-400 font-medium">Estado</th>
              <th className="px-4 py-3 text-right text-slate-400 font-medium">Fecha</th>
              <th className="px-4 py-3 text-right text-slate-400 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No hay órdenes de compra</td></tr>
            ) : orders.map((o: any) => (
              <tr key={o.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="px-4 py-3 font-medium text-white">{o.receipt_number}</td>
                <td className="px-4 py-3 text-right text-slate-300">{o.total_items}</td>
                <td className="px-4 py-3 text-center">
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs text-emerald-400">{o.status}</span>
                </td>
                <td className="px-4 py-3 text-right text-slate-400 text-xs">{o.created_at}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={async () => {
                    const detail = await api.purchases.get(o.id);
                    setViewOrder(detail);
                  }}>
                    <Eye size={14} /> Ver
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreatePurchaseOrder
          products={products}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      {viewOrder && (
        <ViewPurchaseOrder
          order={viewOrder}
          onClose={() => setViewOrder(null)}
        />
      )}
    </div>
  );
}

function CreatePurchaseOrder({ products, onClose, onCreated }: { products: any[]; onClose: () => void; onCreated: () => void }) {
  const [items, setItems] = useState<{ productId: number; quantity: number; unitCost: number }[]>([
    { productId: 0, quantity: 1, unitCost: 0 },
  ]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const activeProducts = products.filter((p: any) => p.isActive);

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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 p-6 shadow-2xl border border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Nueva Recepción</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs text-slate-400 mb-1 block">Producto</label>
                  <select
                    value={item.productId || ""}
                    onChange={(e) => updateItem(i, "productId", parseInt((e.target as HTMLSelectElement).value))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                  >
                    <option value="">Seleccionar...</option>
                    {activeProducts.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label className="text-xs text-slate-400 mb-1 block">Cant.</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onInput={(e) => updateItem(i, "quantity", parseFloat((e.target as HTMLInputElement).value) || 0)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                  />
                </div>
                <div className="w-28">
                  <label className="text-xs text-slate-400 mb-1 block">Costo U.</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitCost}
                    onInput={(e) => updateItem(i, "unitCost", parseFloat((e.target as HTMLInputElement).value) || 0)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                  />
                </div>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-300 px-1 pb-2">
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button type="button" onClick={addItem} className="text-sm text-violet-400 hover:text-violet-300">
            + Agregar otro producto
          </button>

          <input
            placeholder="Notas (opcional)"
            value={notes}
            onInput={(e) => setNotes((e.target as HTMLInputElement).value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-violet-500"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "..." : "Registrar Recepción"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ViewPurchaseOrder({ order, onClose }: { order: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 p-6 shadow-2xl border border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">{order.receipt_number}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">&times;</button>
        </div>

        <p className="text-sm text-slate-400 mb-4">
          {order.notes && <span className="block">{order.notes}</span>}
          <span className="text-xs">{order.created_at}</span>
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="py-2 text-left text-slate-400 font-medium">Producto</th>
              <th className="py-2 text-right text-slate-400 font-medium">Cant.</th>
              <th className="py-2 text-right text-slate-400 font-medium">Costo U.</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((item: any) => (
              <tr key={item.id} className="border-b border-slate-800/50">
                <td className="py-2 text-white">
                  <div className="font-medium">{item.product_name}</div>
                  <div className="text-xs text-slate-500">{item.product_code}</div>
                </td>
                <td className="py-2 text-right text-slate-300">{item.quantity}</td>
                <td className="py-2 text-right text-slate-300">${item.unit_cost.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  );
}