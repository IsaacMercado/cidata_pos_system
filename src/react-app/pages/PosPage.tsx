import {
    Coffee,
    Milk,
    Minus,
    Package,
    Plus,
    Popcorn,
    Sandwich,
    Search,
    ShoppingCart,
    Sparkles,
    X,
} from "lucide-react";
import { useEffect, useState } from "preact/hooks";
import { ReceiptModal } from "../components/pos/ReceiptModal";
import { useToast } from "../components/pos/Toast";
import { Button, Loading, Modal } from "../components/ui";
import { api } from "../lib/api";
import {
    addPendingOp,
    cacheProducts,
    getCachedProducts,
} from "../lib/db";
import type { CartItem, ProductWithCategory, SaleWithItems } from "../lib/types";
import { useOnlineStatus } from "../lib/useOnlineStatus";

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

const CURRENCIES = [
  { code: "USD", label: "$ USD", symbol: "$" },
  { code: "VES", label: "Bs. VES", symbol: "Bs." },
];

const CATEGORY_ICONS: Record<string, typeof Coffee> = {
  Bebidas: Coffee,
  Alimentos: Sandwich,
  Snacks: Popcorn,
  Lácteos: Milk,
  Limpieza: Sparkles,
};

function CategoryIcon({ name }: { name: string }) {
  const Icon = CATEGORY_ICONS[name];
  if (!Icon) return <Package size={20} className="text-indigo-500" />;
  return <Icon size={20} className="text-indigo-500" />;
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
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [currency, setCurrency] = useState<string>("USD");
  const online = useOnlineStatus();
  const { toast } = useToast();

  const rate = exchangeRate || 1;

  useEffect(() => {
    async function load() {
      try {
        const data = await api.products.list();
        await cacheProducts(data);
        const mapped: ProductWithCategory[] = data.map((p) => ({
          ...p,
          category: p.category || null,
        }));
        setProducts(mapped.filter((p) => p.isActive));
      } catch {
        const cached = await getCachedProducts();
        const mapped: ProductWithCategory[] = cached.map((p) => ({
          ...p,
          category: p.category || null,
        }));
        setProducts(mapped.filter((p) => p.isActive));
        if (cached.length > 0) {
          toast("Modo offline — productos cacheados", "success");
        }
      }
      setLoading(false);
    }

    api.exchange.get().then((r) => {
      const usdRate = (r as any)?.USD || 0;
      if (usdRate > 0) setExchangeRate(usdRate);
    }).catch(() => {});

    load();
  }, []);

  const activeOrder = orders.find((o) => o.id === activeOrderId) || orders[0];

  const categories = [...new Set(products.map((p) => p.category?.name).filter(Boolean))] as string[];

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !search || p.name.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q);
    const matchCategory = !selectedCategory || p.category?.name === selectedCategory;
    return matchSearch && matchCategory;
  });

  const totalUSD = +activeOrder.items.reduce((sum, item) => {
    const subtotal = +(item.product.price * item.quantity).toFixed(2);
    const tax = +(subtotal * ((item.product as any).taxRate || 0) / 100).toFixed(2);
    return sum + subtotal + tax;
  }, 0).toFixed(2);

  const totalDisplay = currency === "VES" ? totalUSD * rate : totalUSD;
  const symbol = currency === "VES" ? "Bs." : "$";

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
    setPayments([{ methodId: 1, amount: totalDisplay.toFixed(2) }]);
    setPayDialog(true);
  }

  function addPaymentSplit() {
    const remaining = totalDisplay - payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    if (remaining > 0.01) setPayments((prev) => [...prev, { methodId: 2, amount: remaining.toFixed(2) }]);
  }

  function updatePayment(index: number, field: "methodId" | "amount", value: string | number) {
    setPayments((prev) => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  }

  function removePayment(index: number) {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  }

  const paymentsTotal = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const paymentDiff = totalDisplay - paymentsTotal;

  async function submitPayment() {
    if (Math.abs(paymentDiff) > 0.009 || submitting) return;
    setSubmitting(true);

    const items = activeOrder.items.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      unitPrice: item.product.price,
      discountPercent: 0,
    }));

    const paymentData = {
      payments: payments
        .filter((p) => parseFloat(p.amount) > 0)
        .map((p) => ({
          paymentMethodId: p.methodId,
          amount: +parseFloat(p.amount).toFixed(2),
        })),
    };

    if (!online) {
      try {
        await addPendingOp({
          type: "create_sale",
          payload: {
            status: "in_progress",
            items,
            payments: paymentData.payments,
          },
        });
        setPayDialog(false);
        toast("Venta guardada sin conexión — se sincronizará automáticamente", "success");
        resetOrders();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error guardando offline";
        toast(msg, "error");
      }
      setSubmitting(false);
      return;
    }

    try {
      const sale: any = await api.sales.create({
        status: "in_progress",
        items,
      });

      const paid: any = await api.sales.pay(sale.id, paymentData);

      setPayDialog(false);
      setReceiptSale(paid);
      toast("Venta completada", "success", {
        label: "Imprimir",
        onClick: () => setReceiptSale(paid),
      });

      resetOrders();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast(msg, "error");
    }
    setSubmitting(false);
  }

  function resetOrders() {
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
  }

  if (loading) return <Loading spinner text="Cargando..." />;

  return (
    <>
      <div className="flex h-full flex-col lg:flex-row">
      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-[60]">
          <Button onClick={() => setCartOpen(true)} className="w-full py-3 rounded-xl shadow-lg">
            <ShoppingCart size={18} />
            {activeOrder.name} — {symbol}{totalDisplay.toFixed(2)}
        </Button>
      </div>

      <div className="flex-1 flex flex-col lg:border-r border-zinc-200 pb-20 lg:pb-0">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-zinc-200 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Search size={16} /></span>
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
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            {rate > 0 && <span>Tasa: 1 USD = {rate.toFixed(2)} VES</span>}
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                onClick={() => setCurrency(c.code)}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  currency === c.code ? "bg-indigo-100 text-indigo-700" : "text-zinc-400 hover:text-zinc-600"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 content-start">
          {filtered.map((product) => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              disabled={product.currentStock <= 0}
              className="flex flex-col items-center justify-center p-4 bg-white border border-zinc-200 rounded-xl text-center hover:border-indigo-300 hover:shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center mb-2">
                {product.category ? <CategoryIcon name={product.category.name} /> : <Package size={20} className="text-indigo-500" />}
              </div>
              <span className="text-sm font-semibold text-zinc-800 leading-tight">{product.name}</span>
              <span className="text-xs text-indigo-600 font-medium mt-1">{symbol}{(currency === "VES" ? product.price * rate : product.price).toFixed(2)}</span>
              {product.currentStock <= 5 && product.currentStock > 0 && (
                <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mt-1">
                  {product.currentStock} uds.
                </span>
              )}
              {product.currentStock === 0 && (
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
            <ShoppingCart size={16} /> {activeOrder.name}
            {itemCount > 0 && (
              <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {itemCount}
              </span>
            )}
          </h2>
          <button onClick={() => setCartOpen(false)} className="lg:hidden text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
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
          <Button onClick={addOrder} variant="light" size="sm">
            <Plus size={14} /> Nueva
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-2">
          {activeOrder.items.map((item) => (
            <div key={item.product.id} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-zinc-200">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center flex-shrink-0"><Package size={18} className="text-indigo-500" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-800 truncate">{item.product.name}</p>
                <p className="text-xs text-zinc-400">{symbol}{(currency === "VES" ? item.product.price * rate : item.product.price).toFixed(2)} c/u</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                  className="w-8 h-8"
                  size="sm" variant="ghost"
                ><Minus size={14} /></Button>
                <span className="w-8 text-center text-sm font-semibold text-zinc-800">{item.quantity}</span>
                <Button
                  onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                  className="w-8 h-8"
                  size="sm" variant="ghost"
                ><Plus size={14} /></Button>
              </div>
            </div>
          ))}
          {activeOrder.items.length === 0 && (
            <div className="text-center py-12">
              <ShoppingCart size={40} className="mx-auto mb-2 text-zinc-300" />
              <p className="text-zinc-400 text-sm">Carrito vacío</p>
              <p className="text-zinc-300 text-xs">Selecciona productos para empezar</p>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-200 bg-white p-4 space-y-3">
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between text-zinc-500">
              <span>Total ({currency})</span>
              <span className="font-semibold text-zinc-800">{symbol}{totalDisplay.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            {orders.length > 1 && activeOrder.items.length === 0 && (
              <Button onClick={() => removeOrder(activeOrder.id)} variant="light" className="flex-1">
                Descartar
              </Button>
            )}
            <Button onClick={openPayDialog} disabled={activeOrder.items.length === 0 || submitting} variant="primary" className="flex-1 py-3 rounded-xl shadow-lg shadow-indigo-200">
              Cobrar
            </Button>
          </div>
        </div>
      </div>
    </div>

      <Modal open={payDialog} onClose={() => setPayDialog(false)}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Cobrar {activeOrder.name}</h3>
            <p className="text-sm text-slate-500">Combina efectivo, tarjeta o transferencia.</p>
          </div>
          <button className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100" onClick={() => setPayDialog(false)}>Cerrar</button>
        </div>

        <div className="mb-3 rounded-2xl bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Total en {currency}</span>
            <span className="text-xl font-bold text-slate-900">{symbol}{totalDisplay.toFixed(2)}</span>
          </div>
          {rate > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
              <span>Tasa: 1 USD = {rate.toFixed(2)} VES</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {payments.map((payment, index) => (
            <div key={index} className="grid grid-cols-[1fr_120px_auto] items-center gap-3 rounded-2xl border border-slate-200 p-3">
              <select className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500" value={payment.methodId} onChange={(e: any) => updatePayment(index, "methodId", parseInt(e.target.value))}>
                {pays.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <input className="rounded-xl border border-slate-300 px-3 py-2 text-right text-sm outline-none focus:border-violet-500" type="number" min="0.01" step="0.01" value={payment.amount} onInput={(e: any) => updatePayment(index, "amount", e.target.value)} />
              <button className="rounded-lg px-2 py-1 text-sm text-red-500 hover:bg-red-50" onClick={() => removePayment(index)} disabled={payments.length === 1}><X size={16} /></button>
            </div>
          ))}
        </div>

        <button className="mt-3 w-full rounded-xl border border-dashed border-violet-300 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50" onClick={addPaymentSplit} disabled={paymentDiff <= 0.01}>Agregar otra forma de pago</button>

        <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Pagado</span>
            <span className="font-semibold text-slate-900">{symbol}{paymentsTotal.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-slate-500">Diferencia</span>
            <span className={`font-semibold ${Math.abs(paymentDiff) < 0.009 ? "text-emerald-600" : "text-rose-600"}`}>{Math.abs(paymentDiff) < 0.009 ? "Cuadrado" : `${symbol}${Math.abs(paymentDiff).toFixed(2)}`}</span>
          </div>
        </div>

        <Button variant="success" size="lg" className="mt-4 w-full rounded-2xl" onClick={submitPayment} disabled={submitting || Math.abs(paymentDiff) > 0.009}>
          {submitting ? "Procesando..." : `Confirmar cobro de ${symbol}${totalDisplay.toFixed(2)}`}
        </Button>
      </Modal>

      {receiptSale && <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} />}
    </>
  );
}