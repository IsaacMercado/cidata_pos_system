import { Search, ShoppingBag, Receipt, Trash2, X } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "../../components/ui";

interface TableOrderPanelProps {
  currentTable: any | null;
  activeOrder: any | null;
  draftItems: any[];
  savedItems: any[];
  onAddToDraft: (product: any) => void;
  onUpdateDraftQty: (index: number, quantity: number) => void;
  onRemoveDraftItem: (index: number) => void;
  onSaveOrder: () => void;
  onOpenPayDialog: () => void;
  onClearDraft: () => void;
  submitting: boolean;
  filteredProducts: any[];
  loadingTable: boolean;
  productQuery: string;
  setProductQuery: (value: string) => void;
}

const labelByStatus: Record<string, string> = { available: "Libre", occupied: "En servicio", reserved: "Reservada", maintenance: "Mantenimiento" };

export function TableOrderPanel({ currentTable, activeOrder, draftItems, savedItems, onAddToDraft, onUpdateDraftQty, onRemoveDraftItem, onSaveOrder, onOpenPayDialog, onClearDraft, submitting, filteredProducts, loadingTable, productQuery, setProductQuery }: TableOrderPanelProps) {
  const allOrderItems = [...savedItems, ...draftItems];
  const orderTotal = allOrderItems.reduce((sum, item) => sum + item.total, 0);
  const currentDraftCount = draftItems.length;

  if (!currentTable) return (
    <Card className="flex min-h-[520px] items-center justify-center rounded-3xl border-slate-200 bg-white shadow-sm">
      <div className="max-w-xs px-6 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><ShoppingBag size={25} /></div>
        <h3 className="font-bold text-slate-800">Selecciona una mesa</h3>
        <p className="mt-1 text-sm text-slate-500">Elige una mesa para ver el menú y comenzar la cuenta.</p>
      </div>
    </Card>
  );

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
      <Card className="min-w-0 rounded-3xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">Menú</p>
              <CardTitle className="mt-1">Agregar productos</CardTitle>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" placeholder="Buscar por nombre o código" value={productQuery} onInput={(e: any) => setProductQuery(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="max-h-[calc(100vh-230px)] overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
            {filteredProducts.map((product: any) => (
              <button type="button" key={product.id} className="group rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => onAddToDraft(product)} disabled={product.currentStock <= 0 || loadingTable}>
                <div className="mb-4 flex size-9 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm transition group-hover:bg-violet-600 group-hover:text-white"><ShoppingBag size={16} /></div>
                <div className="truncate text-sm font-semibold text-slate-800">{product.name}</div>
                <div className="mt-1 flex items-end justify-between gap-2"><span className="text-lg font-bold text-violet-700">${product.price.toFixed(2)}</span><span className="text-[0.65rem] text-slate-400">{product.currentStock} {product.unit}</span></div>
              </button>
            ))}
          </div>
          {filteredProducts.length === 0 && <p className="py-12 text-center text-sm text-slate-400">No encontramos productos.</p>}
        </CardContent>
      </Card>

      <Card className="min-w-0 rounded-3xl border-slate-200 bg-white shadow-sm xl:sticky xl:top-4 xl:self-start">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Cuenta activa</p><CardTitle className="mt-1">{currentTable.name}</CardTitle><p className="mt-1 text-xs text-slate-500">{labelByStatus[currentTable.status] || currentTable.status} · {currentTable.capacity} personas</p></div>
            <Receipt className="text-slate-300" size={22} />
          </div>
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">{activeOrder ? `Orden abierta ${activeOrder.receiptNumber}` : currentDraftCount > 0 ? "Borrador local sin guardar" : currentTable.openReceiptNumber ? `Orden abierta ${currentTable.openReceiptNumber}` : "Sin orden abierta"}</div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="max-h-[340px] space-y-2 overflow-y-auto">
            {savedItems.map((item: any, index: number) => <div key={`saved-${item.productId}-${index}`} className="flex items-center gap-2 rounded-xl border border-slate-100 p-3 text-sm"><div className="min-w-0 flex-1"><div className="truncate font-medium">{item.name || `Prod #${item.productId}`}</div><div className="text-[0.65rem] text-slate-400">Guardado en la orden</div></div><span className="text-xs text-slate-500">x{item.quantity}</span><strong>${item.total.toFixed(2)}</strong></div>)}
            {draftItems.map((item: any, index: number) => <div key={`draft-${index}`} className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><div className="min-w-0 flex-1"><div className="truncate font-medium">{item.name}</div><div className="text-[0.65rem] text-amber-700">Nuevo</div></div><input className="w-12 rounded-lg border border-slate-200 bg-white px-1 py-1 text-center text-sm" type="number" min="0.5" step="0.5" value={item.quantity} onInput={(e: any) => onUpdateDraftQty(index, parseFloat(e.target.value) || 0.5)} /><strong>${item.total.toFixed(2)}</strong><button type="button" className="text-slate-400 hover:text-red-500" onClick={() => onRemoveDraftItem(index)} aria-label="Quitar"><X size={15} /></button></div>)}
            {allOrderItems.length === 0 && <div className="py-12 text-center text-sm text-slate-400">La cuenta está vacía.</div>}
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4"><div className="flex items-center justify-between"><span className="text-sm text-slate-500">Total</span><span className="text-2xl font-black text-slate-900">${orderTotal.toFixed(2)}</span></div>
            {currentDraftCount > 0 && <button type="button" className="mt-2 flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600" onClick={onClearDraft}><Trash2 size={13} /> Descartar nuevos</button>}
            <div className="mt-4 space-y-2"><Button onClick={onSaveOrder} disabled={draftItems.length === 0 || submitting} className="w-full rounded-xl bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700 disabled:opacity-50">{submitting ? "Guardando..." : activeOrder ? "Agregar a la cuenta" : "Enviar a la mesa"}</Button><Button onClick={onOpenPayDialog} disabled={!activeOrder || draftItems.length > 0 || submitting} className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{!activeOrder ? "Sin cuenta para cobrar" : draftItems.length > 0 ? "Guarda los nuevos productos" : "Cobrar mesa"}</Button></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
