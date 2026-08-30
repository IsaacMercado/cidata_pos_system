import { useState, useCallback, useMemo } from "preact/hooks";
import { getDatabase } from "../lib/database";
import { useToast } from "../components/pos/Toast";
import { applyDiscounts } from "../lib/currency";
import type { SaleDoc } from "../lib/database";
import type { CartItem, LineDiscount } from "../lib/types";

// ─── Types ──────────────────────────────────────────────────────────────

export interface PaymentInput {
  methodId: number;
  amount: string;
  currency: string;
  reference: string;
  paymentDate: string;
  phone: string;
}

// ─── Constants ──────────────────────────────────────────────────────────

export const PAYMENT_DIFF_TOLERANCE = 0.009;
export const PAYMENT_METHOD_TRANSFER_ID = 3;
export const PAYMENT_METHOD_MOBILE_ID = 4;

// ─── Helpers ────────────────────────────────────────────────────────────

function toPosCurrency(
  amount: number,
  from: string,
  to: string,
  rateMap: Record<string, number>,
): number {
  const fromRate = rateMap[from] || 1;
  const toRate = rateMap[to] || 1;
  return (amount * toRate) / fromRate;
}

function toUsd(
  amount: number,
  currency: string,
  rateMap: Record<string, number>,
): number {
  return toPosCurrency(amount, currency, "USD", rateMap);
}

// ─── Hook ──────────────────────────────────────────────────────────────

interface UsePaymentOptions {
  totalDisplay: number;
  currency: string;
  items: CartItem[];
  rateMap: Record<string, number>;
  onPaid: () => void;
}

export function usePayment({
  totalDisplay,
  currency,
  items,
  rateMap,
  onPaid,
}: UsePaymentOptions) {
  const { toast } = useToast();

  const [payDialog, setPayDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receiptSale, setReceiptSale] = useState<any | null>(null);
  const [payments, setPayments] = useState<PaymentInput[]>([]);

  const paymentsTotal = useMemo(
    () =>
      payments.reduce(
        (sum, p) =>
          sum +
          toPosCurrency(
            parseFloat(p.amount) || 0,
            p.currency,
            currency,
            rateMap,
          ),
        0,
      ),
    [payments, currency, rateMap],
  );
  const paymentDiff = totalDisplay - paymentsTotal;

  const today = () => new Date().toISOString().slice(0, 10);

  const openPayDialog = useCallback(() => {
    if (items.length === 0) return;
    setPayments([
      {
        methodId: 1,
        amount: totalDisplay.toFixed(2),
        currency,
        reference: "",
        paymentDate: today(),
        phone: "",
      },
    ]);
    setPayDialog(true);
  }, [items.length, totalDisplay, currency]);

  const addPaymentSplit = useCallback(() => {
    const remaining = totalDisplay - paymentsTotal;
    if (remaining > 0.01) {
      setPayments((prev) => [
        ...prev,
        {
          methodId: 1,
          amount: remaining.toFixed(2),
          currency,
          reference: "",
          paymentDate: today(),
          phone: "",
        },
      ]);
    }
  }, [totalDisplay, paymentsTotal, currency]);

  const updatePayment = useCallback(
    (index: number, field: keyof PaymentInput, value: string | number) => {
      setPayments((prev) =>
        prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
      );
    },
    [],
  );

  const removePayment = useCallback((index: number) => {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const paymentDetailsError = useCallback(
    (payment: PaymentInput): string | null => {
      if (payment.methodId !== PAYMENT_METHOD_MOBILE_ID && payment.methodId !== PAYMENT_METHOD_TRANSFER_ID) return null;
      if (!payment.reference) return "Referencia requerida";
      if (!payment.paymentDate) return "Fecha requerida";
      if (payment.methodId === PAYMENT_METHOD_MOBILE_ID && !payment.phone) return "Teléfono requerido";
      return null;
    },
    [],
  );

  const submitPayment = useCallback(async () => {
    if (Math.abs(paymentDiff) > PAYMENT_DIFF_TOLERANCE || submitting) return;
    if (payments.some((p) => paymentDetailsError(p))) {
      toast("Complete los datos del pago", "error");
      return;
    }
    setSubmitting(true);

    const db = await getDatabase();

    const now = new Date().toISOString();
    const clientId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    const saleItems = items.map((item) => {
       const unitPrice = item.reservation ? item.reservation.total : item.product.price;
       const quantity = item.reservation ? 1 : item.quantity;
      const baseSubtotal = unitPrice * quantity;
      const discountsUsd: LineDiscount[] = (item.discounts ?? []).map((d) =>
        d.type === "fixed"
          ? { ...d, value: toUsd(d.value, currency, rateMap) }
          : d,
      );
      const { discountAmount } = applyDiscounts(baseSubtotal, discountsUsd);
      const roundedDiscount = Math.round(discountAmount * 100) / 100;
      const lineSubtotal = baseSubtotal - roundedDiscount;
      const roundedSubtotal = Math.round(lineSubtotal * 100) / 100;
      const itemTaxRate = item.product.taxRate || 0;
      const itemTax = Math.round(roundedSubtotal * (itemTaxRate / 100) * 100) / 100;
      subtotal += roundedSubtotal;
      discountTotal += roundedDiscount;
      taxTotal += itemTax;
      const discountPercentEquivalent = baseSubtotal > 0 ? (roundedDiscount / baseSubtotal) * 100 : 0;
      return {
        productId: item.product.id,
        quantity,
        unitPrice,
        discounts: discountsUsd,
        discountPercent: Math.round(discountPercentEquivalent * 100) / 100,
        discountAmount: roundedDiscount,
      };
    });

    subtotal = Math.round(subtotal * 100) / 100;
    discountTotal = Math.round(discountTotal * 100) / 100;
    taxTotal = Math.round(taxTotal * 100) / 100;
    // `subtotal` already excludes discounts (it is the net line subtotal), so the
    // total is net subtotal + tax, matching the worker's computed sale totals.
    const total = Math.round((subtotal + taxTotal) * 100) / 100;

    const validPayments = payments.filter((p) => parseFloat(p.amount) > 0);
    const totalPaymentsUsd = validPayments.reduce(
      (s, p) => s + toUsd(parseFloat(p.amount), p.currency, rateMap),
      0,
    );

    const reservationData = items
      .filter((item) => item.reservation)
      .map((item) => ({
        productId: item.product.id,
        checkIn: item.reservation!.checkIn,
        checkOut: item.reservation!.checkOut,
         total: item.reservation!.total,
          guests: 1,
          guestPrice: item.product.price,
          guestName: item.reservation!.guestName,
          guestEmail: item.reservation!.guestEmail,
          guestPhone: item.reservation!.guestPhone,
       }));
    if (reservationData.some((reservation) => reservation.checkOut <= reservation.checkIn)) {
      toast("El check-out debe ser posterior al check-in", "error");
      setSubmitting(false);
      return;
    }

    const saleDoc: SaleDoc = {
      rxid: clientId,
      clientId,
      serverId: null,
      customerId: null,
      userId: null,
      tableId: null,
      tableName: null,
      subtotal,
      taxTotal,
      discountTotal,
      total,
      status: "completed",
      notes: null,
      items: saleItems,
      ...(reservationData.length > 0 ? { reservations: reservationData } : {}),
      payments: validPayments.map((p) => ({
        paymentMethodId: p.methodId,
        amount:
          totalPaymentsUsd > 0
            ? Math.round(
                total *
                  (toUsd(parseFloat(p.amount), p.currency, rateMap) /
                    totalPaymentsUsd) *
                  100,
              ) / 100
            : 0,
        currency: p.currency === "VES" ? "VES" : "USD",
        amountOriginal: parseFloat(p.amount) || 0,
        reference: p.reference || null,
        paymentDate: p.paymentDate || null,
        phone: p.phone || null,
      })),
      syncStatus: "pending",
      receiptNumber: `LOCAL-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
      _deleted: false,
    };

    const receiptItems = saleItems.map((item) => {
      const baseSubtotal = item.unitPrice * item.quantity;
      const discountAmount = baseSubtotal * (item.discountPercent / 100);
      return {
        ...item,
        name: item.productId.toString(),
        subtotal: Math.round((baseSubtotal - discountAmount) * 100) / 100,
        id: Math.random(),
      };
    });

    const receiptSaleData = {
      ...saleDoc,
      items: receiptItems,
      payments: payments
        .filter((p) => parseFloat(p.amount) > 0)
        .map((p) => ({
          id: Math.random(),
          paymentMethodId: p.methodId,
          amount: +parseFloat(p.amount).toFixed(2),
          currency: p.currency,
          reference: p.reference || null,
          paymentDate: p.paymentDate || null,
          phone: p.phone || null,
        })),
    } as any;

    await db.sales.insert(saleDoc);

    setPayDialog(false);
    setReceiptSale(receiptSaleData);
    toast("Venta completada", "success", {
      label: "Recibo",
      onClick: () => setReceiptSale(receiptSaleData),
    });
    onPaid();
    setSubmitting(false);
  }, [
    paymentDiff,
    submitting,
    payments,
    items,
    rateMap,
    paymentDetailsError,
    toast,
    onPaid,
  ]);

  return {
    payDialog,
    setPayDialog,
    submitting,
    receiptSale,
    setReceiptSale,
    payments,
    paymentsTotal,
    paymentDiff,
    openPayDialog,
    addPaymentSplit,
    updatePayment,
    removePayment,
    paymentDetailsError,
    submitPayment,
  };
}
