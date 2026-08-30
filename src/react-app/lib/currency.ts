import {
  Coffee,
  Milk,
  Package,
  Popcorn,
  Sandwich,
  Sparkles,
} from "lucide-react";
import type { DiscountType, LineDiscount, ProductRate } from "./types";

// ─── Symbols ──────────────────────────────────────────────────────────────────

export const SYMBOLS: Record<string, string> = {
  USD: "$",
  VES: "Bs.",
  EUR: "€",
};

export function getSymbol(code: string): string {
  return SYMBOLS[code] || code;
}

// ─── Category icons ──────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, typeof Coffee> = {
  Bebidas: Coffee,
  Alimentos: Sandwich,
  Snacks: Popcorn,
  Lácteos: Milk,
  Limpieza: Sparkles,
};

export function getCategoryIcon(name: string) {
  const Icon = CATEGORY_ICONS[name];
  if (Icon) return Icon;
  return Package;
}

// ─── Price helpers ────────────────────────────────────────────────────────────

export function priceInCurrency(
  product: { price: number; rates?: ProductRate[] },
  currency: string,
): number {
  if (currency === "USD") return product.price;
  const rateEntry = product.rates?.find((r) => r.code === currency);
  return rateEntry ? rateEntry.rate : product.price;
}

export function lineItemTotal(
  item: {
    product: { price: number; taxRate?: number; rates?: ProductRate[] };
    quantity: number;
  },
  currency: string,
): number {
  const unitPrice = priceInCurrency(item.product, currency);
  const taxRate = item.product.taxRate || 0;
  const subtotal = +(unitPrice * item.quantity).toFixed(2);
  const tax = +((subtotal * taxRate) / 100).toFixed(2);
  return subtotal + tax;
}

/**
 * Format a price value with symbol. E.g. "$12.50" or "Bs.1250.00"
 */
export function formatPrice(value: number, currency: string): string {
  return `${getSymbol(currency)}${value.toFixed(2)}`;
}

// ─── Discounts ────────────────────────────────────────────────────────────────

export interface DiscountApplication {
  type: DiscountType;
  value: number;
  amount: number;
}

export interface DiscountResult {
  discountAmount: number;
  total: number;
  perDiscount: DiscountApplication[];
}

/**
 * Apply a list of discounts sequentially over a base amount. Percentages apply
 * to the running subtotal; fixed amounts subtract a flat value. The running
 * total is never pushed below zero.
 */
export function applyDiscounts(
  base: number,
  discounts: LineDiscount[],
): DiscountResult {
  let running = Math.round(base * 100) / 100;
  const perDiscount: DiscountApplication[] = [];

  for (const discount of discounts) {
    let amount = 0;
    if (discount.type === "percent") {
      amount = running * (discount.value / 100);
    } else {
      amount = discount.value;
    }
    amount = Math.min(Math.max(amount, 0), running);
    amount = Math.round(amount * 100) / 100;
    running = Math.round((running - amount) * 100) / 100;
    perDiscount.push({ type: discount.type, value: discount.value, amount });
  }

  const discountAmount = Math.round((base - running) * 100) / 100;
  return { discountAmount, total: running, perDiscount };
}

export interface DiscountedLineTotals {
  base: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}

/**
 * Compute the discounted totals for a cart line in the given display currency.
 * Taxes are applied over the discounted subtotal.
 */
export function discountedLineTotal(
  item: {
    product: { price: number; taxRate?: number; rates?: ProductRate[] };
    quantity: number;
    discounts?: LineDiscount[];
    reservation?: { total: number } | undefined;
  },
  currency: string,
): DiscountedLineTotals {
  const unitLocal = priceInCurrency(item.product, currency);
  const base = item.reservation
    ? item.reservation.total
    : Math.round(unitLocal * item.quantity * 100) / 100;
  const { discountAmount } = applyDiscounts(base, item.discounts ?? []);
  const taxRate = item.product.taxRate || 0;
  const discountedSubtotal = Math.round((base - discountAmount) * 100) / 100;
  const tax = Math.round(((discountedSubtotal * taxRate) / 100) * 100) / 100;
  const total = Math.round((discountedSubtotal + tax) * 100) / 100;
  return { base, discountAmount, taxAmount: tax, total };
}
