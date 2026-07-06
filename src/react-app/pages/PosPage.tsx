import { useState, useEffect } from "preact/hooks";
import type { ProductWithCategory, CartItem, SaleWithItems } from "../lib/types";
import { api } from "../lib/api";
import { useToast } from "../components/pos/Toast";
import { ReceiptModal } from "../components/pos/ReceiptModal";

interface Order {
  id: number;
  name: string;
  items: CartItem[];
  createdAt: Date;
}

const pays = [
  { id: 1, code: "cash", name: "Efectivo" },
  { id: 2, code: "card", name: "Tarjeta" },
  { id: 3, code: "transfer", name: "Transferencia" },
  { id: 4, code: "mobile", name: "Pago Móvil" },
];

function categoryEmoji(name: string) {
  const map: Record<string, string> = {
    Bebidas: "☕", Alimentos: "🥪", Snacks: "🍿", Lácteos: "🥛", Limpieza: "🧹",
  };
  return map[name] || "📦";
}

let orderIdCounter = 0;

function createOrder(name?: string): Order {
  orderIdCounter += 1;
  return { id: orderIdCounter, name: name || `Orden ${orderIdCounter}`, items: [], createdAt: new Date() };
}

export function PosPage() {
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [orders, setOrders] = useState<Order[]>([createOrder("Orden 1")]);
  const [activeOrderId, setActiveOrderId] = useState<number>(1);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [receiptSale, setReceiptSale] = useState<SaleWithItems | null>(null);
  const [payDialog, setPayDialog] = useState(false);
  const [payments, setPayments] = useState<{ methodId: number; amount: string }[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    api.products.list().then((data: any[]) => {
      const mapped: ProductWithCategory[] = data.map((p) => ({
        ...p,
        category: p.category || null,
        current_stock: p.currentStock,
        is_active: p.isActive,
        tax_rate: p.taxRate ?? 0,
      }));
      setProducts(mapped.filter((p) => p.is_active));
      setLoading(false);
    });
  }, []);

  const activeOrder = orders.find((o) => o.id === activeOrderId) || orders[0];

  const categories = [...new Set(products.map((p) => p.category?.name).filter(Boolean))] as string[];

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !search || p.name.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q);
    const matchCategory = !selectedCategory || p.category?.name === selectedCategory;
    return matchSearch && matchCategory;
  });

  const total = +activeOrder.items.reduce((sum, item) => {
    const subtotal = +(item.product.price * item.quantity).toFixed(2);
    const tax = +(subtotal * ((item.product as any).tax_rate || 0) / 100).toFixed(2);
    return sum + subtotal + tax;
  }, 0).toFixed(2);
  const itemCount = activeOrder.items.reduce((sum, item) => sum + item.quantity, 0);

  function addToCart(product: ProductWithCategory) {
    setOrders((prev) => prev.map((order) => {
      if (order.id !== activeOrderId) return order;
      const existing = order.items.find((item) => item.product.id === product.id);
      if (existing) {
        return {
          ...order,
          items: order.items.map((item) =>
            item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
          ),
        };
      }
      return { ...order, items: [...order.items, { product, quantity: 1 }] };
    }));
  }

  function updateQuantity(productId: number, qty: number) {
    setOrders((prev) => prev.map((order) => {
      if (order.id !== activeOrderId) return order;
      return {
        ...order,
        items: qty <= 0
          ? order.items.filter((item) => item.product.id !== productId)
          : order.items.map((item) => (item.product.id === productId ? { ...item, quantity: qty } : item)),
      };
    }));
  }

  function addOrder() {
    const newOrder = createOrder();
    setOrders((prev) => [...prev, newOrder]);
    setActiveOrderId(newOrder.id);
  }

  function removeOrder(id: number) {
    if (orders.length <= 1) return;
    setOrders((prev) => {
      const next = prev.filter((o) => o.id !== id);
      if (activeOrderId === id) {
        setActiveOrderId(next[0].id);
      }
      return next;
    });
  }

  function switchOrder(id: number) {
    setActiveOrderId(id);
    setCartOpen(false);
  }

  function openPayDialog() {
    if (activeOrder.items.length === 0) return;
    setPayments([{ methodId: 1, amount: total.toFixed(2) }]);
    setPayDialog(true);
  }

  function addPaymentSplit() {
    const remaining = total - payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    if (remaining > 0.01) setPayments((prev) => [...prev, { methodId: 2, amount: remaining.toFixed(2) }]);
  }

  function updatePayment(index: number, field: "methodId" | "amount", value: string | number) {
    setPayments((prev) => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  }

  function removePayment(index: number) {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  }

  const paymentsTotal = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const paymentDiff = total - paymentsTotal;

  async function submitPayment() {
    if (Math.abs(paymentDiff) > 0.009 || submitting) return;
    setSubmitting(true);
    try {
      const sale: any = await api.sales.create({
        status: "in_progress",
        items: activeOrder.items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.product.price,
          discountPercent: 0,
        })),
      });

      const paid: any = await api.sales.pay(sale.id, {
        payments: payments
          .filter((p) => parseFloat(p.amount) > 0)
          .map((p) => ({
            paymentMethodId: p.methodId,
            amount: +parseFloat(p.amount).toFixed(2),
          })),
      });

      setPayDialog(false);
      setReceiptSale(paid);
      toast("Venta completada", "success", {
        label: "Imprimir",
        onClick: () => setReceiptSale(paid),
      });

      setOrders((prev) => {
        const next = prev.filter((o) => o.id !== activeOrderId);
        if (next.length === 0) {
          const fresh = createOrder("Orden 1");
          setActiveOrderId(fresh.id);
          return [fresh];
        }
        if (activeOrderId === next[0]?.id || !next.find((o) => o.id === activeOrderId)) {
          setActiveOrderId(next[0].id);
        }
        return next;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast(msg, "error");
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-full border-2 border-zinc-300 border-t-indigo-500 animate-spin" />
          <span className="text-sm">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col lg:flex-row">
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-30">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl shadow-lg flex items-center justify-center gap-2 font-medium"
          >
            <span>🛒</span>
            {activeOrder.name} — ${total.toFixed(2)}
          </button>
        </div>

        <div className="flex-1 flex flex-col lg:border-r border-zinc-200 pb-20 lg:pb-0">
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-zinc-200 p-3 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">🔍</span>
              <input
                type="text"
                placeholder="Buscar producto..."
                value={search}
                onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-indigo-400 focus:bg-white transition-colors"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory((e.target as HTMLSelectElement).value)}
              className="px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-indigo-400 focus:bg-white transition-colors"
            >
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-auto p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 content-start">
            {filtered.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.current_stock <= 0}
                className="flex flex-col items-center justify-center p-4 bg-white border border-zinc-200 rounded-xl text-center hover:border-indigo-300 hover:shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center text-xl mb-2">
                  {product.category ? categoryEmoji(product.category.name) : "📦"}
                </div>
                <span className="text-sm font-semibold text-zinc-800 leading-tight">{product.name}</span>
                <span className="text-xs text-indigo-600 font-medium mt-1">
                  ${product.price.toFixed(2)}
                </span>
                {product.current_stock <= 5 && product.current_stock > 0 && (
                  <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mt-1">
                    {product.current_stock} uds.
                  </span>
                )}
                {product.current_stock === 0 && (
                  <span className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded mt-1">
                    Agotado
                  </span>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full text-center text-zinc-400 py-12 text-sm">Sin resultados</p>
            )}
          </div>
        </div>

        {cartOpen && (
          <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setCartOpen(false)} />
        )}

        <div
          className={`fixed lg:static inset-y-0 right-0 z-40 w-full sm:w-96 bg-zinc-50 flex flex-col shadow-2xl lg:shadow-none transition-transform duration-300 ${
            cartOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="px-4 py-3 border-b border-zinc-200 bg-white flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              🛒 {activeOrder.name}
              {itemCount > 0 && (
                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {itemCount}
                </span>
              )}
            </h2>
            <button onClick={() => setCartOpen(false)} className="lg:hidden text-zinc-400 hover:text-zinc-600">✕</button>
          </div>

          <div className="px-4 py-2 border-b border-zinc-200 bg-white flex items-center gap-2 overflow-auto">
            {orders.map((order) => (
              <button
                key={order.id}
                onClick={() => switchOrder(order.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                  order.id === activeOrderId
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                }`}
              >
                {order.name}
                {order.items.length > 0 && (
                  <span className="text-[10px] opacity-60">({order.items.length})</span>
                )}
              </button>
            ))}
            <button
              onClick={addOrder}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-zinc-100 text-zinc-500 hover:bg-indigo-100 hover:text-indigo-600 transition-colors flex-shrink-0"
            >
              + Nueva
            </button>
          </div>

          <div className="flex-1 overflow-auto p-3 space-y-2">
            {activeOrder.items.map((item) => (
              <div key={item.product.id} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-zinc-200">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center text-sm flex-shrink-0">📦</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800 truncate">{item.product.name}</p>
                  <p className="text-xs text-zinc-400">${item.product.price.toFixed(2)} c/u</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    className="w-8 h-8 flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 rounded-lg text-sm text-zinc-600 transition-colors"
                  >−</button>
                  <span className="w-8 text-center text-sm font-semibold text-zinc-800">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    className="w-8 h-8 flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 rounded-lg text-sm text-zinc-600 transition-colors disabled:opacity-30"
                  >+</button>
                </div>
              </div>
            ))}
            {activeOrder.items.length === 0 && (
              <div className="text-center py-12">
                <p className="text-3xl mb-2">🛒</p>
                <p className="text-zinc-400 text-sm">Carrito vacío</p>
                <p className="text-zinc-300 text-xs">Selecciona productos para empezar</p>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-200 bg-white p-4 space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between text-zinc-500">
                <span>Total</span>
                <span className="font-semibold text-zinc-800">${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              {orders.length > 1 && activeOrder.items.length === 0 && (
                <button
                  onClick={() => removeOrder(activeOrder.id)}
                  className="flex-1 py-3 bg-zinc-100 text-zinc-500 rounded-xl text-sm font-medium hover:bg-red-100 hover:text-red-600 transition-colors"
                >
                  Descartar
                </button>
              )}
              <button
                onClick={openPayDialog}
                disabled={activeOrder.items.length === 0 || submitting}
                className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl text-sm font-semibold hover:from-indigo-500 hover:to-indigo-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-lg shadow-indigo-200"
              >
                Cobrar
              </button>
            </div>
          </div>
        </div>
      </div>

      {payDialog && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/45 p-3 sm:items-center">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Cobrar {activeOrder.name}</h3>
                <p className="text-sm text-slate-500">Combina efectivo, tarjeta o transferencia.</p>
              </div>
              <button className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100" onClick={() => setPayDialog(false)}>Cerrar</button>
            </div>

            <div className="mb-3 rounded-2xl bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Total</span>
                <span className="text-xl font-bold text-slate-900">${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3">
              {payments.map((payment, index) => (
                <div key={index} className="grid grid-cols-[1fr_120px_auto] items-center gap-3 rounded-2xl border border-slate-200 p-3">
                  <select className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500" value={payment.methodId} onChange={(e: any) => updatePayment(index, "methodId", parseInt(e.target.value))}>
                    {pays.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <input className="rounded-xl border border-slate-300 px-3 py-2 text-right text-sm outline-none focus:border-violet-500" type="number" min="0.01" step="0.01" value={payment.amount} onInput={(e: any) => updatePayment(index, "amount", e.target.value)} />
                  <button className="rounded-lg px-2 py-1 text-sm text-red-500 hover:bg-red-50" onClick={() => removePayment(index)} disabled={payments.length === 1}>✕</button>
                </div>
              ))}
            </div>

            <button className="mt-3 w-full rounded-xl border border-dashed border-violet-300 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50" onClick={addPaymentSplit} disabled={paymentDiff <= 0.01}>Agregar otra forma de pago</button>

            <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Pagado</span>
                <span className="font-semibold text-slate-900">${paymentsTotal.toFixed(2)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-slate-500">Diferencia</span>
                <span className={`font-semibold ${Math.abs(paymentDiff) < 0.009 ? "text-emerald-600" : "text-rose-600"}`}>{Math.abs(paymentDiff) < 0.009 ? "Cuadrado" : `$${Math.abs(paymentDiff).toFixed(2)}`}</span>
              </div>
            </div>

            <button className="mt-4 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-base font-semibold text-white disabled:opacity-50" onClick={submitPayment} disabled={submitting || Math.abs(paymentDiff) > 0.009}>
              {submitting ? "Procesando..." : `Confirmar cobro de $${total.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}

      {receiptSale && <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} />}
    </>
  );
}
