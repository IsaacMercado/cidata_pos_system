import { useEffect, useState } from "preact/hooks";
import { api } from "../lib/api";
import { addPendingOp, cacheProducts, getCachedProducts } from "../lib/db";
import { paymentMethods } from "../lib/paymentMethods";
import { useOnlineStatus } from "../lib/useOnlineStatus";

interface CartItem {
  productId: number;
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export function PosPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showNumpad, setShowNumpad] = useState<number | null>(null);
  const [numpadValue, setNumpadValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [payDialog, setPayDialog] = useState(false);
  const [payments, setPayments] = useState<{ methodId: number; amount: string }[]>([]);
  const online = useOnlineStatus();

  useEffect(() => {
    void loadProducts();
  }, [online]);

  async function loadProducts() {
    if (online) {
      try {
        const data = await api.products.list({});
        await cacheProducts(data);
        setProducts(data);
        return;
      } catch {}
    }
    setProducts(await getCachedProducts());
  }

  const filtered = query
    ? products.filter((p: any) =>
        p.name?.toLowerCase().includes(query.toLowerCase()) ||
        p.code?.toLowerCase().includes(query.toLowerCase()) ||
        p.barcode?.includes(query),
      )
    : products;

  function addToCart(product: any) {
    setDone(false);
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice }
            : item,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          code: product.code,
          name: product.name,
          quantity: 1,
          unitPrice: product.price,
          total: product.price,
        },
      ];
    });
  }

  function updateQty(index: number, qty: number) {
    setCart((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? { ...item, quantity: Math.max(0.001, qty), total: Math.max(0.001, qty) * item.unitPrice }
          : item,
      ),
    );
  }

  function removeItem(index: number) {
    setCart((prev) => prev.filter((_, idx) => idx !== index));
  }

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);

  function openPayDialog() {
    if (cart.length === 0 || submitting) return;
    if (!online) {
      void checkoutOffline();
      return;
    }
    setPayments([{ methodId: 1, amount: subtotal.toFixed(2) }]);
    setPayDialog(true);
  }

  async function checkoutOffline() {
    setSubmitting(true);
    const payload = {
      items: cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    };

    await addPendingOp({ type: "create_sale", payload });
    setCart([]);
    setDone(true);
    setSubmitting(false);
    setTimeout(() => setDone(false), 3000);
  }

  function addPaymentSplit() {
    const remaining = subtotal - payments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
    if (remaining > 0.01) {
      setPayments((prev) => [...prev, { methodId: 2, amount: remaining.toFixed(2) }]);
    }
  }

  function updatePayment(index: number, field: "methodId" | "amount", value: number | string) {
    setPayments((prev) => prev.map((payment, idx) => (idx === index ? { ...payment, [field]: value } : payment)));
  }

  function removePayment(index: number) {
    setPayments((prev) => prev.filter((_, idx) => idx !== index));
  }

  const paymentsTotal = payments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
  const paymentDiff = subtotal - paymentsTotal;

  async function confirmPayment() {
    if (cart.length === 0 || submitting || Math.abs(paymentDiff) > 0.009) return;
    setSubmitting(true);

    const salePayload = {
      status: "in_progress",
      items: cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    } as const;

    try {
      const sale = await api.sales.create(salePayload);
      await api.sales.pay(sale.id, {
        payments: payments.map((payment) => ({
          paymentMethodId: payment.methodId,
          amount: parseFloat(payment.amount),
        })),
      });
      setPayDialog(false);
      setCart([]);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (error) {
      alert("Error al cobrar: " + (error as Error).message);
    }

    setSubmitting(false);
  }

  function handleNumpad(index: number) {
    const qty = parseFloat(numpadValue);
    if (qty > 0) updateQty(index, qty);
    setShowNumpad(null);
    setNumpadValue("");
  }

  return (
    <div>
      {done && (
        <div className="mb-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
          {online ? "Venta completada ✅" : "Venta guardada localmente — se sincronizará automáticamente"}
        </div>
      )}

      {payDialog && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/45 p-3 sm:items-center">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Cobrar venta</h3>
                <p className="text-sm text-slate-500">Puedes combinar varias formas de pago en la misma orden.</p>
              </div>
              <button className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100" onClick={() => setPayDialog(false)}>
                Cerrar
              </button>
            </div>

            <div className="mb-3 rounded-2xl bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Total de la venta</span>
                <span className="text-xl font-bold text-slate-900">${subtotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3">
              {payments.map((payment, index) => (
                <div key={index} className="grid grid-cols-[1fr_120px_auto] items-center gap-3 rounded-2xl border border-slate-200 p-3">
                  <select
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
                    value={payment.methodId}
                    onChange={(e: any) => updatePayment(index, "methodId", parseInt(e.target.value))}
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.id} value={method.id}>{method.name}</option>
                    ))}
                  </select>
                  <input
                    className="rounded-xl border border-slate-300 px-3 py-2 text-right text-sm outline-none focus:border-violet-500"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={payment.amount}
                    onInput={(e: any) => updatePayment(index, "amount", e.target.value)}
                  />
                  <button
                    className="rounded-lg px-2 py-1 text-sm text-red-500 hover:bg-red-50 disabled:opacity-40"
                    onClick={() => removePayment(index)}
                    disabled={payments.length === 1}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>

            <button
              className="mt-3 w-full rounded-xl border border-dashed border-violet-300 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
              onClick={addPaymentSplit}
              disabled={paymentDiff <= 0.01}
            >
              Agregar otra forma de pago
            </button>

            <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Pagado</span>
                <span className="font-semibold text-slate-900">${paymentsTotal.toFixed(2)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-slate-500">Diferencia</span>
                <span className={`font-semibold ${Math.abs(paymentDiff) < 0.009 ? "text-emerald-600" : "text-rose-600"}`}>
                  {Math.abs(paymentDiff) < 0.009 ? "Cuadrado" : `$${Math.abs(paymentDiff).toFixed(2)}`}
                </span>
              </div>
            </div>

            <button
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600 px-4 py-3 text-base font-semibold text-white disabled:opacity-50"
              onClick={confirmPayment}
              disabled={submitting || Math.abs(paymentDiff) > 0.009}
            >
              {submitting ? "Procesando..." : `Confirmar cobro de $${subtotal.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}

      <div className={`grid gap-3 ${cart.length > 0 ? "lg:grid-cols-[1fr_320px]" : "grid-cols-1"}`}>
        <div>
          <div className="relative mb-2">
            <svg className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              className="w-full rounded-2xl border border-slate-300 bg-white/90 py-3 pl-9 pr-3 text-base outline-none transition focus:border-violet-500 focus:ring-3 focus:ring-violet-500/15"
              placeholder="Buscar producto por nombre, código o barcode..."
              value={query}
              onInput={(e: any) => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          <div className="mb-2 flex flex-wrap gap-1.5">
            {["", "Bebidas", "Alimentos", "Lácteos", "Limpieza"].map((cat) => (
              <button
                key={cat}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  query === cat ? "bg-gradient-to-r from-violet-600 to-cyan-600 text-white" : "border border-slate-200 bg-white/90 text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => setQuery(cat)}
              >
                {cat || "Todos"}
              </button>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
            {filtered.map((product: any) => (
              <button
                key={product.id}
                className="flex flex-col items-center gap-1 rounded-2xl border border-slate-200 bg-white/90 p-3 text-center text-xs transition hover:border-violet-300 hover:shadow-sm active:scale-95 disabled:opacity-40"
                onClick={() => addToCart(product)}
                disabled={product.currentStock <= 0}
              >
                <div className="w-full truncate text-sm font-semibold">{product.name}</div>
                <div className="text-sm font-bold text-violet-700">${product.price.toFixed(2)}</div>
                <div className={`text-[0.65rem] ${product.currentStock <= product.minStock ? "text-red-500" : "text-slate-400"}`}>
                  Stock: {product.currentStock} {product.unit}
                </div>
              </button>
            ))}
          </div>
        </div>

        {cart.length > 0 && (
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-[0_20px_45px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">Carrito ({cart.length})</span>
              <button className="text-xs font-medium text-red-500 hover:text-red-600" onClick={() => setCart([])}>
                Vaciar
              </button>
            </div>

            <div className="max-h-[50vh] flex-1 space-y-1 overflow-y-auto">
              {cart.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 border-b border-slate-100 py-2 text-sm">
                  <div className="flex-1 truncate">{item.name}</div>
                  <div>
                    {showNumpad === idx ? (
                      <div className="flex items-center gap-1">
                        <input
                          className="w-14 rounded-lg border border-slate-300 px-1 py-0.5 text-xs outline-none focus:border-violet-500"
                          type="number"
                          step="0.001"
                          value={numpadValue}
                          onInput={(e: any) => setNumpadValue(e.target.value)}
                          autoFocus
                        />
                        <button className="rounded-lg bg-violet-600 px-1.5 py-0.5 text-xs text-white" onClick={() => handleNumpad(idx)}>OK</button>
                      </div>
                    ) : (
                      <span
                        className="inline-block w-8 cursor-pointer text-center font-semibold underline decoration-dotted"
                        onClick={() => {
                          setNumpadValue(String(item.quantity));
                          setShowNumpad(idx);
                        }}
                      >
                        {item.quantity}
                      </span>
                    )}
                  </div>
                  <div className="min-w-[60px] text-right font-semibold">${item.total.toFixed(2)}</div>
                  <button className="text-sm text-red-400 hover:text-red-600" onClick={() => removeItem(idx)}>✕</button>
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between border-t-2 border-slate-800 py-3 text-lg font-bold">
              <span>Total</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>

            <button
              className="w-full rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600 px-4 py-3 text-base font-semibold text-white transition active:scale-95 disabled:opacity-50"
              onClick={openPayDialog}
              disabled={submitting}
            >
              {submitting ? "Procesando..." : online ? `Cobrar ($${subtotal.toFixed(2)})` : `Guardar venta offline ($${subtotal.toFixed(2)})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
