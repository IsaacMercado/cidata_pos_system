import { Minus, Package, Plus, ShoppingCart, X } from "lucide-react";
import { Button } from "../ui";
import { priceInCurrency } from "../../lib/currency";
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
  const showUsdEquiv = currency !== "USD";

  const inner = (
    <>
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <ShoppingCart size={16} /> {activeOrder.name}
          {itemCount > 0 && (
            <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{itemCount}</span>
          )}
        </h2>
        <button onClick={() => setCartOpen(false)} className={`text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 ${mobile ? "" : "md:hidden"}`}><X size={18} /></button>
      </div>

      {/* ── Order tabs ── */}
      <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2 overflow-x-auto flex-shrink-0 pos-scrollbar">
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

      {/* ── Cart items ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0 pos-scrollbar">
        {activeOrder.items.map((item) => {
          const localPrice = priceInCurrency(item.product, currency);
          const usdPrice = item.product.price;
          const isReservation = item.reservation;
          const lineTotal = isReservation && item.reservation
            ? item.reservation.total
            : +(localPrice * item.quantity).toFixed(2);
          const lineTotalUsd = isReservation && item.reservation
            ? item.reservation.total
            : +(usdPrice * item.quantity).toFixed(2);

          return (
            <div key={item.product.id} className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30 flex items-center justify-center flex-shrink-0">
                <Package size={18} className="text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">
                  {item.product.name}
                  {isReservation && <span className="text-[10px] text-emerald-600 ml-1">(Reserva)</span>}
                </p>
                {isReservation && item.reservation ? (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {item.reservation.checkIn} → {item.reservation.checkOut}
                  </p>
                ) : (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {symbol}{localPrice.toFixed(2)} c/u
                    {showUsdEquiv && <span className="ml-1 text-zinc-300 dark:text-zinc-600">· ${usdPrice.toFixed(2)}</span>}
                  </p>
                )}
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  {symbol}{lineTotal.toFixed(2)}
                  {showUsdEquiv && <span className="ml-1 text-zinc-400 dark:text-zinc-500 font-normal">(${lineTotalUsd.toFixed(2)})</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)} className="w-8 h-8" size="sm" variant="ghost"><Minus size={14} /></Button>
                <span className="w-8 text-center text-sm font-semibold text-zinc-800 dark:text-zinc-100">{item.quantity}</span>
                <Button onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)} className="w-8 h-8" size="sm" variant="ghost" disabled={!isReservation && item.product.productType === "simple" && item.quantity >= item.product.currentStock}><Plus size={14} /></Button>
              </div>
            </div>
          );
        })}
        {activeOrder.items.length === 0 && (
          <div className="text-center py-12">
            <ShoppingCart size={40} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
            <p className="text-zinc-400 dark:text-zinc-500 text-sm">Carrito vacío</p>
            <p className="text-zinc-300 dark:text-zinc-600 text-xs">Selecciona productos para empezar</p>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3 flex-shrink-0">
        <div className="space-y-1 text-sm">
          {showUsdEquiv && rate > 0 && (
            <div className="flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500">
              <span>Tasa: 1 USD = {rate.toFixed(2)} {currency}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span>Total ({currency})</span>
            <span className="font-bold text-lg text-zinc-800 dark:text-zinc-100">{symbol}{totalDisplay.toFixed(2)}</span>
          </div>
          {showUsdEquiv && (
            <div className="flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
              <span>Total (USD)</span>
              <span className="font-medium">${(totalDisplay / (rate || 1)).toFixed(2)}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {hasMultipleOrders && activeOrderEmpty && (
            <Button onClick={() => onRemoveOrder(activeOrderId)} variant="light" className="flex-1">Descartar</Button>
          )}
          <Button
            onClick={onOpenPay}
            disabled={activeOrderEmpty || submitting}
            variant="primary"
            className="flex-1 py-3 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30"
          >
            Cobrar
          </Button>
        </div>
      </div>
    </>
  );

  if (mobile) {
    return (
      <>
        {cartOpen && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setCartOpen(false)} />}
        <div className={`fixed md:hidden inset-y-0 right-0 z-40 w-full sm:w-80 bg-zinc-50 dark:bg-zinc-900 flex flex-col shadow-2xl border-l dark:border-zinc-800 transition-transform duration-300 ${cartOpen ? "translate-x-0" : "translate-x-full"}`}>
          {inner}
        </div>
      </>
    );
  }

  return (
    <aside className="hidden md:flex md:flex-col md:w-80 lg:w-96 md:border-l md:border-zinc-200 dark:md:border-zinc-800 md:bg-zinc-50 dark:md:bg-zinc-900 md:shadow-2xl">
      {inner}
    </aside>
  );
}
