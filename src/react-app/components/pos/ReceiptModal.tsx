import { useEffect, useRef } from "preact/hooks";
import type { SaleWithItems } from "../../lib/types";

const methodLabel: Record<number, string> = {
  1: "Efectivo",
  2: "Tarjeta",
  3: "Transferencia",
  4: "Pago Móvil",
};

export function ReceiptModal({
  sale,
  onClose,
}: {
  sale: SaleWithItems;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  function handlePrint() {
    window.print();
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="rounded-2xl shadow-2xl border border-zinc-200 p-0 backdrop:bg-black/30 w-full max-w-sm m-auto print:shadow-none print:border-none"
    >
      <div className="p-6 space-y-4">
        <div className="text-center border-b border-zinc-100 pb-4">
          <h2 className="text-lg font-bold text-zinc-800">pos-system</h2>
          <p className="text-xs text-zinc-400">Punto de Venta</p>
          <p className="text-xs text-zinc-400 mt-1">
            {new Date(sale.created_at).toLocaleDateString()}{" "}
            {new Date(sale.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-xs text-zinc-400">Recibo: {sale.receipt_number}</p>
        </div>

        {sale.customer && (
          <p className="text-sm text-zinc-600">
            <span className="text-zinc-400">Cliente:</span> {sale.customer.name}
          </p>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-400 text-xs uppercase">
              <th className="text-left font-medium pb-1">Producto</th>
              <th className="text-center font-medium pb-1">Cant</th>
              <th className="text-right font-medium pb-1">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {sale.sale_items?.map((item) => (
              <tr key={item.id} className="border-t border-zinc-100">
                <td className="py-1.5 text-zinc-800">{item.product.name}</td>
                <td className="py-1.5 text-center text-zinc-600">{item.quantity}</td>
                <td className="py-1.5 text-right font-medium">
                  ${item.subtotal.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-zinc-200 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-zinc-500">
            <span>Subtotal</span>
            <span>${sale.subtotal.toFixed(2)}</span>
          </div>
          {sale.sale_payments?.map((p) => (
            <div key={p.id} className="flex justify-between text-zinc-500">
              <span>{methodLabel[p.payment_method_id] || `Método ${p.payment_method_id}`}</span>
              <span>${p.amount.toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between text-base font-bold text-zinc-800 pt-1 border-t border-zinc-100">
            <span>Total</span>
            <span>${sale.total.toFixed(2)}</span>
          </div>
        </div>

        <p className="text-center text-[10px] text-zinc-300 pt-2 border-t border-zinc-100">
          Gracias por su compra
        </p>
      </div>

      <div className="flex gap-2 p-4 pt-0 print:hidden">
        <button
          onClick={handlePrint}
          className="flex-1 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors"
        >
          Imprimir
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-2.5 bg-zinc-100 text-zinc-600 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </dialog>
  );
}
