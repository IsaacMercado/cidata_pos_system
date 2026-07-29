import {
  Coffee,
  Milk,
  Package,
  Popcorn,
  Sandwich,
  Sparkles,
} from "lucide-react";
import type { ProductRate } from "./types";

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
