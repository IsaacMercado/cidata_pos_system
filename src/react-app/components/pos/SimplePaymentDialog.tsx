import { X, Plus } from "lucide-react";
import { Dialog, Button } from "../ui";
import { PAYMENT_METHODS } from "../../lib/paymentMethods";

// ─── Simple PaymentDialog (used by RestaurantsPage) ─────────────────────────
// This is a simpler version without mobile payment fields or multi-currency.

interface PaymentSplit {
  methodId: number;
  amount: string;
}

interface SimplePaymentDialogProps {
  open: boolean;
  onClose: () => void;
  total: number;
  currency: string;
  rate: number;
  payments: PaymentSplit[];
  paymentsTotal: number;
  paymentDiff: number;
  submitting: boolean;
  onAddPaymentSplit: () => void;
  onUpdatePayment: (index: number, field: "methodId" | "amount", value: string | number) => void;
  onRemovePayment: (index: number) => void;
  onSubmitPayment: () => void;
}

export function SimplePaymentDialog({
  open,
  onClose,
  total,
  currency,
  rate,
  payments,
  paymentsTotal,
  paymentDiff,
  submitting,
  onAddPaymentSplit,
  onUpdatePayment,
  onRemovePayment,
  onSubmitPayment,
}: SimplePaymentDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Cobrar cuenta</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Combina efectivo, tarjeta o transferencia en la misma cuenta.</p>
        </div>
        <button className="rounded-lg px-2 py-1 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="mb-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>Total en {currency}</span>
          <span className="text-xl font-bold text-slate-900 dark:text-slate-100">${total.toFixed(2)}</span>
        </div>
        {rate > 0 && (
          <div className="mt-1 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
            <span>Tasa: 1 USD = {rate.toFixed(2)} VES</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {payments.map((payment, index) => (
          <div key={index} className="grid grid-cols-[1fr_120px_auto] items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 p-3">
            <select
              className="rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm outline-none focus:border-violet-500 dark:bg-slate-800 dark:text-white"
              value={payment.methodId}
              onChange={(e: any) => onUpdatePayment(index, "methodId", parseInt(e.target.value))}
            >
              {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <input
              className="rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2 text-right text-sm outline-none focus:border-violet-500 dark:bg-slate-800 dark:text-white"
              type="number"
              min="0.01"
              step="0.01"
              value={payment.amount}
              onInput={(e: any) => onUpdatePayment(index, "amount", e.target.value)}
            />
            <button
              className="rounded-lg px-2 py-1 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-30"
              onClick={() => onRemovePayment(index)}
              disabled={payments.length === 1}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <button
        className="mt-3 w-full rounded-xl border border-dashed border-violet-300 dark:border-violet-700 px-4 py-2 text-sm font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30"
        onClick={onAddPaymentSplit}
        disabled={paymentDiff <= 0.01}
      >
        <Plus size={14} className="inline mr-1 -mt-0.5" />
        Agregar otra forma de pago
      </button>

      <div className="mt-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">Pagado</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">${paymentsTotal.toFixed(2)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">Diferencia</span>
          <span className={`font-semibold ${Math.abs(paymentDiff) < 0.009 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {Math.abs(paymentDiff) < 0.009 ? "✓ Cuadrado" : `$${Math.abs(paymentDiff).toFixed(2)}`}
          </span>
        </div>
      </div>

      <Button
        variant="success"
        size="lg"
        className="mt-4 w-full rounded-2xl"
        onClick={onSubmitPayment}
        disabled={submitting || Math.abs(paymentDiff) > 0.009}
      >
        {submitting ? "Procesando..." : `Confirmar cobro de $${total.toFixed(2)}`}
      </Button>
    </Dialog>
  );
}
