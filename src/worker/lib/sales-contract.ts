import { z } from "zod";

export const lineDiscountSchema = z.object({
  type: z.enum(["fixed", "percent"]),
  value: z.number().finite().min(0),
  label: z.string().trim().max(100).optional(),
});

export const saleItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().finite().positive(),
  unitPrice: z.number().finite().min(0),
  discounts: z.array(lineDiscountSchema).default([]),
  // Optional aggregate fields kept for backwards compatibility with clients
  // that still send a single percentage-based discount.
  discountPercent: z.number().finite().min(0).max(100).optional(),
  discountAmount: z.number().finite().min(0).optional(),
});

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface ComputedSaleItem {
  productId: number;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  discounts: { type: "fixed" | "percent"; value: number; label?: string }[];
  subtotal: number;
  taxAmount: number;
  total: number;
}

/**
 * Apply a list of discounts sequentially over the line base amount. Percentages
 * apply to the running subtotal; fixed amounts subtract a flat value. The
 * running total is never pushed below zero. Returns the persisted row values
 * (including the aggregate discount_percent/discount_amount used by Odoo) plus a
 * JSON-serialisable `discounts` detail.
 */
export function computeSaleItemValues(
  saleId: number,
  item: {
    productId: number;
    quantity: number;
    unitPrice: number;
    discounts?: { type: "fixed" | "percent"; value: number; label?: string }[];
    discountPercent?: number;
  },
  taxRate = 0,
): ComputedSaleItem {
  const baseSubtotal = item.quantity * item.unitPrice;
  const discounts =
    item.discounts && item.discounts.length > 0
      ? item.discounts
      : item.discountPercent
        ? [{ type: "percent" as const, value: item.discountPercent }]
        : [];

  let running = round2(baseSubtotal);
  for (const discount of discounts) {
    const amount =
      discount.type === "percent"
        ? round2((running * discount.value) / 100)
        : Math.min(discount.value, running);
    running = round2(running - amount);
  }
  const discountAmount = round2(baseSubtotal - running);
  const subtotal = running;
  const taxAmount = round2((subtotal * taxRate) / 100);
  const discountPercent = baseSubtotal > 0 ? round2((discountAmount / baseSubtotal) * 100) : 0;

  return {
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discountPercent,
    discountAmount,
    discounts,
    subtotal,
    taxAmount,
    total: round2(subtotal + taxAmount),
  };
}

export const salePaymentSchema = z.object({
  paymentMethodId: z.number().int().positive(),
  amount: z.number().finite().positive(),
  currency: z.enum(["USD", "VES"]).default("USD"),
  amountOriginal: z.number().finite().positive().optional(),
  exchangeRate: z.number().finite().positive().optional(),
  reference: z.string().trim().max(200).optional(),
  paymentDate: z.string().trim().max(40).optional(),
  phone: z.string().trim().max(40).optional(),
});

export const salePaymentsSchema = z.array(salePaymentSchema);

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Fecha inválida");

export const reservationSchema = z.object({
  productId: z.number().int().positive(),
  checkIn: dateOnly,
  checkOut: dateOnly,
  guests: z.number().int().positive().default(1),
  guestPrice: z.number().finite().min(0).default(0),
  total: z.number().finite().min(0),
  guestName: z.string().trim().min(1).max(200).optional(),
  guestEmail: z.string().trim().email().max(255).optional(),
  guestPhone: z.string().trim().max(40).optional(),
  customerId: z.number().int().positive().optional(),
}).superRefine((reservation, ctx) => {
  if (reservation.checkOut <= reservation.checkIn) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["checkOut"], message: "Check-out debe ser posterior al check-in" });
  }
  if (Math.abs(reservation.total - reservationTotal(reservation)) > 0.01) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["total"], message: "El total no coincide con noches, huéspedes y precio" });
  }
});

export const salePushSchema = z.object({
  clientId: z.string().trim().min(1).max(100),
  rxid: z.string().trim().min(1).max(100),
  items: z.array(saleItemSchema).min(1),
  payments: salePaymentsSchema,
  customerId: z.number().int().positive().optional(),
  userId: z.number().int().positive().optional(),
  tableId: z.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(["completed", "in_progress"]).default("completed"),
  reservations: z.array(reservationSchema).optional(),
}).superRefine((body, ctx) => {
  if (body.status === "completed" && body.payments.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["payments"], message: "Una venta completada requiere pagos" });
  }
});

export type SalePushInput = z.infer<typeof salePushSchema>;

export function reservationNights(checkIn: string, checkOut: string): number {
  return Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86400000);
}

export function reservationTotal(reservation: Pick<z.infer<typeof reservationSchema>, "checkIn" | "checkOut" | "guestPrice" | "guests">): number {
  return Math.round(reservationNights(reservation.checkIn, reservation.checkOut) * reservation.guestPrice * reservation.guests * 100) / 100;
}

export function validatePaymentDetails(payments: z.infer<typeof salePaymentsSchema>) {
  return payments.every((payment) => {
    if (payment.paymentMethodId === 4) return !!payment.reference && !!payment.paymentDate && !!payment.phone;
    if (payment.paymentMethodId === 3) return !!payment.reference && !!payment.paymentDate;
    return true;
  });
}
