import { Minus, Package, Plus, ShoppingCart, X } from "lucide-react";
import { Button } from "../ui";
import type { CartItem } from "../../lib/types";

interface CartAsideProps {
  mobile?: boolean;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  orders: { id: number; name: string; items: CartItem[] }[];
  activeOrderId: number;
  itemCount: number;
  totalDisplay: number;
  symbol: string;
  currency: string;
  rate: number;
  submitting: boolean;
  hasMultipleOrders: boolean;
  activeOrderEmpty: boolean;
  onSwitchOrder: (id: number) => void;
  onAddOrder: () => void;
  onRemoveOrder: (id: number) => void;
  onOpenPay: () => void;
  onUpdateQuantity: (productId: number, qty: number) => void;
}

export function CartAside({
  mobile = false,
  cartOpen,
  setCartOpen,
  orders,
  activeOrderId,
  itemCount,
  totalDisplay,
  symbol,
  currency,
  rate,
  submitting,
  hasMultipleOrders,
  activeOrderEmpty,
  onSwitchOrder,
  onAddOrder,
  onRemoveOrder,
  onOpenPay,
  onUpdateQuantity,
}: CartAsideProps) {
  const activeOrder = orders.find((o) => o.id === activeOrderId) || orders[0];

  const inner = (
    <>
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <ShoppingCart size={16} /> {activeOrder.name}
          {itemCount > 0 && (
            <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{itemCount}</span>
          )}
        </h2>
        <button onClick={() => setCartOpen(false)} className={`text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 ${mobile ? "" : "lg:hidden"}`}><X size={18} /></button>
      </div>

      <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2 overflow-auto">
        {orders.map((order) => (
          <button
            key={order.id}
            onClick={() => onSwitchOrder(order.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              order.id === activeOrderId
                ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            {order.name}
            {order.items.length > 0 && <span className="text-[10px] opacity-60">({order.items.length})</span>}
          </button>
        ))}
        <Button onClick={onAddOrder} variant="light" size="sm"><Plus size={14} /> Nueva</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {activeOrder.items.map((item) => (
          <div key={item.product.id} className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30 flex items-center justify-center flex-shrink-0"><Package size={18} className="text-indigo-500" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{item.product.name}</p>
              <p className="text-xs text-zinc-400">{symbol}{(currency === "VES" ? item.product.price * rate : item.product.price).toFixed(2)} c/u</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)} className="w-8 h-8" size="sm" variant="ghost"><Minus size={14} /></Button>
              <span className="w-8 text-center text-sm font-semibold text-zinc-800 dark:text-zinc-100">{item.quantity}</span>
              <Button onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)} className="w-8 h-8" size="sm" variant="ghost"><Plus size={14} /></Button>
            </div>
          </div>
        ))}
        {activeOrder.items.length === 0 && (
          <div className="text-center py-12">
            <ShoppingCart size={40} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
            <p className="text-zinc-400 dark:text-zinc-500 text-sm">Carrito vacío</p>
            <p className="text-zinc-300 dark:text-zinc-600 text-xs">Selecciona productos para empezar</p>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span>Total ({currency})</span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-100">{symbol}{totalDisplay.toFixed(2)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {hasMultipleOrders && activeOrderEmpty && (
            <Button onClick={() => onRemoveOrder(activeOrderId)} variant="light" className="flex-1">Descartar</Button>
          )}
          <Button onClick={onOpenPay} disabled={activeOrderEmpty || submitting} variant="primary" className="flex-1 py-3 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30">Cobrar</Button>
        </div>
      </div>
    </>
  );

  if (mobile) {
    return (
      <>
        {cartOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setCartOpen(false)} />}
        <div className={`fixed lg:hidden inset-y-0 right-0 z-40 w-full sm:w-96 bg-zinc-50 dark:bg-zinc-900 flex flex-col shadow-2xl border-l dark:border-zinc-800 transition-transform duration-300 ${cartOpen ? "translate-x-0" : "translate-x-full"}`}>
          {inner}
        </div>
      </>
    );
  }

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-96 lg:border-l lg:border-zinc-200 dark:lg:border-zinc-800 lg:bg-zinc-50 dark:lg:bg-zinc-900 lg:shadow-2xl">
      {inner}
    </aside>
  );
}
