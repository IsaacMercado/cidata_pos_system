import { useState, useCallback } from "preact/hooks";
import { Dialog, Button, Input, Select, Card, CardHeader, CardTitle, CardContent } from "../ui";
import { X, Plus } from "lucide-react";
import { PAYMENT_METHODS } from "../../lib/paymentMethods";

interface PaymentSplit {
  methodId: number;
  amount: string;
}

interface PaymentDialogProps {
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

const paymentMethods = PAYMENT_METHODS;

export function PaymentDialog({
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
}: PaymentDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} size="md">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <CardTitle>Cobrar cuenta</CardTitle>
          <p className="text-sm text-slate-500">Combina efectivo, tarjeta o transferencia en la misma cuenta.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
          <X size={20} />
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Total en {currency}</span>
            <span className="text-xl font-bold">${total.toFixed(2)}</span>
          </div>
          {rate > 0 && (
            <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
              <span>Tasa: 1 USD = {rate.toFixed(2)} VES</span>
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-3">
            {payments.map((payment, index) => (
              <div key={index} className="grid grid-cols-[1fr_120px_auto] items-center gap-3 rounded-2xl border border-slate-200 p-3">
                <Select
                  value={payment.methodId}
                  onChange={(e: any) => onUpdatePayment(index, "methodId", parseInt(e.target.value))}
                  options={paymentMethods.map((m) => ({ value: String(m.id), label: m.name }))}
                />
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={payment.amount}
                  onChange={(e: any) => onUpdatePayment(index, "amount", e.target.value)}
                  className="text-right"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemovePayment(index)}
                  disabled={payments.length === 1}
                  className="text-red-500 hover:text-red-600"
                  aria-label="Quitar forma de pago"
                >
                  <X size={16} />
                </Button>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={onAddPaymentSplit}
            disabled={paymentDiff <= 0.01}
          >
            <Plus size={16} className="mr-1" /> Agregar otra forma de pago
          </Button>

          <Card className="mt-3">
            <CardContent className="pt-0 pb-0">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Pagado</span>
                <span className="font-semibold">${paymentsTotal.toFixed(2)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-slate-500">Diferencia</span>
                <span className={`font-semibold ${Math.abs(paymentDiff) < 0.009 ? "text-emerald-600" : "text-rose-600"}`}>
                  {Math.abs(paymentDiff) < 0.009 ? "Cuadrado" : `$${Math.abs(paymentDiff).toFixed(2)}`}
                </span>
              </div>
            </CardContent>
          </Card>

          <Button
            variant="success"
            size="lg"
            className="mt-4 w-full rounded-2xl"
            onClick={onSubmitPayment}
            disabled={submitting || Math.abs(paymentDiff) > 0.009}
          >
            {submitting ? "Procesando..." : `Confirmar cobro de $${total.toFixed(2)}`}
          </Button>
        </CardContent>
      </Card>
    </Dialog>
  );
}

export function usePaymentSplit() {
  const [payments, setPayments] = useState<PaymentSplit[]>([{ methodId: 1, amount: "0" }]);

  const addPaymentSplit = useCallback((total: number) => {
    const remaining = total - payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    if (remaining > 0.01) setPayments((prev) => [...prev, { methodId: 2, amount: remaining.toFixed(2) }]);
  }, [payments]);

  const updatePayment = useCallback((index: number, field: "methodId" | "amount", value: string | number) => {
    setPayments((prev) => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  }, []);

  const removePayment = useCallback((index: number) => {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const paymentsTotal = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  return { payments, setPayments, addPaymentSplit, updatePayment, removePayment, paymentsTotal };
}