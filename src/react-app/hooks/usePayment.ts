import { useState, useCallback } from "preact/hooks";
import { getDatabase } from "../lib/database";
import { useToast } from "../components/pos/Toast";
import type { SaleDoc } from "../lib/database";
import type { CartItem } from "../lib/types";

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
export const PAYMENT_METHOD_MOBILE_ID = 4;

// ─── Hook ──────────────────────────────────────────────────────────────

interface UsePaymentOptions {
  totalDisplay: number;
  currency: string;
  items: CartItem[];
  onPaid: () => void;
}

export function usePayment({ totalDisplay, currency, items, onPaid }: UsePaymentOptions) {
  const { toast } = useToast();

  const [payDialog, setPayDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receiptSale, setReceiptSale] = useState<any | null>(null);
  const [payments, setPayments] = useState<PaymentInput[]>([]);

  const paymentsTotal = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const paymentDiff = totalDisplay - paymentsTotal;

  const today = () => new Date().toISOString().slice(0, 10);

  const openPayDialog = useCallback(() => {
    if (items.length === 0) return;
    setPayments([{
      methodId: 1,
      amount: totalDisplay.toFixed(2),
      currency,
      reference: "",
      paymentDate: today(),
      phone: "",
    }]);
    setPayDialog(true);
  }, [items.length, totalDisplay, currency]);

  const addPaymentSplit = useCallback(() => {
    const remaining = totalDisplay - paymentsTotal;
    if (remaining > 0.01) {
      setPayments((prev) => [...prev, {
        methodId: 1,
        amount: remaining.toFixed(2),
        currency,
        reference: "",
        paymentDate: today(),
        phone: "",
      }]);
    }
  }, [totalDisplay, paymentsTotal, currency]);

  const updatePayment = useCallback((index: number, field: keyof PaymentInput, value: string | number) => {
    setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }, []);

  const removePayment = useCallback((index: number) => {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const mobilePaymentError = useCallback((payment: PaymentInput): string | null => {
    if (payment.methodId !== PAYMENT_METHOD_MOBILE_ID) return null;
    if (!payment.reference) return "Referencia requerida";
    if (!payment.paymentDate) return "Fecha requerida";
    if (!payment.phone) return "Teléfono requerido";
    return null;
  }, []);

  const submitPayment = useCallback(async () => {
    if (Math.abs(paymentDiff) > PAYMENT_DIFF_TOLERANCE || submitting) return;
    if (payments.some((p) => mobilePaymentError(p))) {
      toast("Complete los datos del pago móvil", "error");
      return;
    }
    setSubmitting(true);

    const db = await getDatabase();

    const now = new Date().toISOString();
    const clientId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    let subtotal = 0;
    let discountTotal = 0;
    const saleItems = items.map((item) => {
      const unitPrice = item.product.price;
      const quantity = item.quantity;
      const discountPercent = 0;
      const baseSubtotal = unitPrice * quantity;
      const discountAmount = baseSubtotal * (discountPercent / 100);
      const lineSubtotal = baseSubtotal - discountAmount;
      const roundedSubtotal = Math.round(lineSubtotal * 100) / 100;
      const roundedDiscount = Math.round(discountAmount * 100) / 100;
      subtotal += roundedSubtotal;
      discountTotal += roundedDiscount;
      return {
        productId: item.product.id,
        quantity,
        unitPrice,
        discountPercent,
      };
    });

    subtotal = Math.round(subtotal * 100) / 100;
    discountTotal = Math.round(discountTotal * 100) / 100;
    const taxTotal = 0;
    const total = Math.round((subtotal - discountTotal) * 100) / 100;

    const validPayments = payments.filter((p) => parseFloat(p.amount) > 0);
    const totalPaymentsDisplay = validPayments.reduce((s, p) => s + parseFloat(p.amount), 0);

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
      payments: validPayments.map((p) => ({
        paymentMethodId: p.methodId,
        amount: totalPaymentsDisplay > 0
          ? Math.round(total * (parseFloat(p.amount) / totalPaymentsDisplay) * 100) / 100
          : 0,
        currency: "USD",
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

    for (const item of saleItems) {
      const productDoc = await db.products.findOne(String(item.productId)).exec();
      if (productDoc) {
        await productDoc.incrementalPatch({ currentStock: productDoc.currentStock - item.quantity });
      }
    }

    setPayDialog(false);
    setReceiptSale(receiptSaleData);
    toast("Venta completada", "success", {
      label: "Recibo",
      onClick: () => setReceiptSale(receiptSaleData),
    });
    onPaid();
    setSubmitting(false);
  }, [paymentDiff, submitting, payments, items, mobilePaymentError, toast, onPaid]);

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
    mobilePaymentError,
    submitPayment,
  };
}