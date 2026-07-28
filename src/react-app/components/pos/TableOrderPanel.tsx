import { useState } from "preact/hooks";
import { SubmitHandler, useForm } from "react-hook-form";
import { useToast } from "../pos/Toast";
import { Button, Card, CardHeader, CardTitle, CardContent, CardFooter, Input, Select, Badge } from "../../components/ui";
import { api } from "../../lib/api";
import { useOnlineStatus } from "../../lib/useOnlineStatus";
import { Plus, Minus, Trash2, X } from "lucide-react";

interface TableOrderPanelProps {
  currentTable: any | null;
  restaurant: any;
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

export function TableOrderPanel({
  currentTable,
  restaurant,
  activeOrder,
  draftItems,
  savedItems,
  onAddToDraft,
  onUpdateDraftQty,
  onRemoveDraftItem,
  onSaveOrder,
  onOpenPayDialog,
  onClearDraft,
  submitting,
  filteredProducts,
  loadingTable,
  productQuery,
  setProductQuery,
}: TableOrderPanelProps) {
  const { toast } = useToast();
  const online = useOnlineStatus();
  const allOrderItems = [...savedItems, ...draftItems];
  const orderTotal = allOrderItems.reduce((sum, item) => sum + item.total, 0);
  const payableTotal = activeOrder?.total ?? orderTotal;
  const currentDraftCount = draftItems.length;

  if (!currentTable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
          <p className="text-xs text-slate-500">Sin mesa seleccionada</p>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
            Selecciona una mesa para empezar a cargar la cuenta.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>{currentTable.name}</CardTitle>
          <p className="text-xs text-slate-500">{labelByStatus[currentTable.status] || currentTable.status} · {currentTable.capacity} personas</p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
          {activeOrder ? `Orden abierta ${activeOrder.receiptNumber}` : currentDraftCount > 0 ? "Borrador local" : currentTable.openReceiptNumber ? `Orden abierta ${currentTable.openReceiptNumber}` : "Sin orden"}
        </div>
      </CardHeader>

      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-9 pr-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
          placeholder="Buscar productos para la mesa..."
          value={productQuery}
          onInput={(e: any) => setProductQuery(e.target.value)}
        />
      </div>

      {!currentTable && (
        <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
          Selecciona una mesa para empezar a cargar la cuenta.
        </div>
      )}

      {currentTable && (
        <CardContent className="pb-0">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
            {filteredProducts.map((product: any) => (
              <button
                key={product.id}
                className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-violet-300 hover:shadow-sm disabled:opacity-40"
                onClick={() => onAddToDraft(product)}
                disabled={product.currentStock <= 0 || loadingTable}
              >
                <div className="mb-2 truncate text-sm font-semibold">{product.name}</div>
                <div className="text-lg font-bold text-violet-700">${product.price.toFixed(2)}</div>
                <div className="mt-2 text-[0.7rem] text-slate-400">Stock {product.currentStock} {product.unit}</div>
              </button>
            ))}
          </div>
        </CardContent>
      )}

      <CardContent className="pt-0">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Cuenta</h3>
            <p className="text-xs text-slate-500">Mesa activa: {currentTable.name}</p>
          </div>
          {currentDraftCount > 0 && <button className="text-xs font-medium text-red-500 hover:text-red-600" onClick={onClearDraft}>Descartar nuevos</button>}
        </div>

        <div className="space-y-2">
          {savedItems.map((item: any) => (
            <div key={`saved-${item.id}`} className="flex items-center gap-2 rounded-2xl border border-slate-100 px-3 py-2 text-sm">
              <div className="flex-1">
                <div className="font-medium">{item.name || `Prod #${item.productId}`}</div>
                <div className="text-[0.7rem] text-slate-400">Guardado en la orden</div>
              </div>
              <div className="text-xs text-slate-500">x{item.quantity}</div>
              <div className="font-semibold">${item.total.toFixed(2)}</div>
            </div>
          ))}
          {draftItems.map((item: any, index: number) => (
            <div key={`draft-${index}`} className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm">
              <div className="flex-1">
                <div className="font-medium">{item.name}</div>
                <div className="text-[0.7rem] text-amber-700">Nuevo en esta mesa</div>
              </div>
              <input
                className="w-14 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm outline-none focus:border-violet-500"
                type="number"
                min="0.5"
                step="0.5"
                value={item.quantity}
                onInput={(e: any) => onUpdateDraftQty(index, parseFloat(e.target.value) || 0.5)}
              />
              <div className="font-semibold">${item.total.toFixed(2)}</div>
              <button className="text-red-500 hover:text-red-600" onClick={() => onRemoveDraftItem(index)}>✕</button>
            </div>
          ))}
        </div>

        {allOrderItems.length === 0 && <div className="py-10 text-center text-sm text-slate-400">La mesa no tiene productos todavía.</div>}

        <div className="mt-4 border-t border-slate-200 pt-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Total</span>
            <span className="text-2xl font-bold">${orderTotal.toFixed(2)}</span>
          </div>

          <div className="space-y-2">
            <Button
              onClick={onSaveOrder}
              disabled={!currentTable || draftItems.length === 0 || submitting}
              className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? "Guardando..." : activeOrder ? "Agregar a la mesa" : "Enviar a la mesa"}
            </Button>
            <Button
              onClick={onOpenPayDialog}
              disabled={!activeOrder || draftItems.length > 0 || submitting}
              className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {!activeOrder ? "No hay cuenta abierta" : draftItems.length > 0 ? "Guarda nuevos items antes de cobrar" : "Cobrar mesa"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const labelByStatus: Record<string, string> = {
  available: "Libre",
  occupied: "En servicio",
  reserved: "Reservada",
  maintenance: "Mantenimiento",
};