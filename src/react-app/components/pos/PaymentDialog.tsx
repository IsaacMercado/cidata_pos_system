import { X, Plus, Smartphone } from "lucide-react";
import { Dialog, Button } from "../ui";
import { PAYMENT_METHODS } from "../../lib/paymentMethods";
import type { PaymentInput } from "../../hooks/usePayment";
import { PAYMENT_DIFF_TOLERANCE, PAYMENT_METHOD_MOBILE_ID } from "../../hooks/usePayment";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  orderName: string;
  totalDisplay: number;
  symbol: string;
  currency: string;
  exchangeRateText: string | null;
  payments: PaymentInput[];
  paymentsTotal: number;
  paymentDiff: number;
  submitting: boolean;
  onUpdatePayment: (index: number, field: keyof PaymentInput, value: string | number) => void;
  onRemovePayment: (index: number) => void;
  onAddPaymentSplit: () => void;
  onSubmit: () => void;
  getMobileError: (p: PaymentInput) => string | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PaymentDialog({
  open,
  onClose,
  orderName,
  totalDisplay,
  symbol,
  currency,
  exchangeRateText,
  payments,
  paymentsTotal,
  paymentDiff,
  submitting,
  onUpdatePayment,
  onRemovePayment,
  onAddPaymentSplit,
  onSubmit,
  getMobileError,
}: PaymentDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      {/* ── Header ── */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Cobrar {orderName}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Combina efectivo, tarjeta, transferencia o pago móvil.</p>
        </div>
        <button
          className="rounded-lg px-2 py-1 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={onClose}
        >
          Cerrar
        </button>
      </div>

      {/* ── Total summary ── */}
      <div className="mb-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>Total en {currency}</span>
          <span className="text-xl font-bold text-slate-900 dark:text-slate-100">{symbol}{totalDisplay.toFixed(2)}</span>
        </div>
        {exchangeRateText && (
          <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 mt-1">
            <span>Tasa: {exchangeRateText}</span>
          </div>
        )}
      </div>

      {/* ── Payment splits ── */}
      <div className="space-y-3 max-h-[40vh] overflow-y-auto pos-scrollbar pr-1">
        {payments.map((payment, index) => {
          const mobileError = getMobileError(payment);
          const isMobile = payment.methodId === PAYMENT_METHOD_MOBILE_ID;

          return (
            <div key={index} className={`rounded-2xl border p-3 space-y-3 transition-colors ${
              isMobile
                ? "border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10"
                : "border-slate-200 dark:border-slate-700"
            }`}>
              {/* Method + amount row */}
              <div className="grid grid-cols-[1fr_120px_auto] items-center gap-3">
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

              {/* ── Mobile payment fields (referencia, fecha, teléfono) ── */}
              {isMobile && (
                <div className="space-y-2 border-t border-violet-200 dark:border-violet-800 pt-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 mb-2">
                    <Smartphone size={14} />
                    Datos del pago móvil
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Referencia *</label>
                      <input
                        className="rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-xs outline-none focus:border-violet-500 dark:bg-slate-800 dark:text-white"
                        type="text"
                        placeholder="Ej: 123456"
                        value={payment.reference}
                        onInput={(e: any) => onUpdatePayment(index, "reference", e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Fecha *</label>
                      <input
                        className="rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-xs outline-none focus:border-violet-500 dark:bg-slate-800 dark:text-white"
                        type="date"
                        value={payment.paymentDate}
                        onInput={(e: any) => onUpdatePayment(index, "paymentDate", e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Teléfono *</label>
                      <input
                        className="rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-xs outline-none focus:border-violet-500 dark:bg-slate-800 dark:text-white"
                        type="tel"
                        placeholder="0412..."
                        value={payment.phone}
                        onInput={(e: any) => onUpdatePayment(index, "phone", e.target.value)}
                      />
                    </div>
                  </div>
                  {mobileError && (
                    <p className="text-[10px] text-red-500 flex items-center gap-1 mt-1">
                      ⚠ {mobileError}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Add split button ── */}
      <button
        className="mt-3 w-full rounded-xl border border-dashed border-violet-300 dark:border-violet-700 px-4 py-2 text-sm font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors disabled:opacity-40"
        onClick={onAddPaymentSplit}
        disabled={paymentDiff <= 0.01}
      >
        <Plus size={14} className="inline mr-1 -mt-0.5" />
        Agregar otra forma de pago
      </button>

      {/* ── Payment summary ── */}
      <div className="mt-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">Pagado</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{symbol}{paymentsTotal.toFixed(2)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">Diferencia</span>
          <span className={`font-semibold ${Math.abs(paymentDiff) < PAYMENT_DIFF_TOLERANCE ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {Math.abs(paymentDiff) < PAYMENT_DIFF_TOLERANCE ? "✓ Cuadrado" : `${symbol}${Math.abs(paymentDiff).toFixed(2)}`}
          </span>
        </div>
      </div>

      {/* ── Submit ── */}
      <Button
        variant="success"
        size="lg"
        className="mt-4 w-full rounded-2xl"
        onClick={onSubmit}
        disabled={submitting || Math.abs(paymentDiff) > PAYMENT_DIFF_TOLERANCE}
      >
        {submitting ? "Procesando..." : `Confirmar cobro de ${symbol}${totalDisplay.toFixed(2)}`}
      </Button>
    </Dialog>
  );
}