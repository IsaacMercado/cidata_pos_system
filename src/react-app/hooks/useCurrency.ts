import { useCallback, useMemo, useState } from "preact/hooks";
import { getSymbol } from "../lib/currency";
import type { ProductRate } from "../lib/types";

const STORAGE_KEY = "pos_currency";

export interface CurrencyOption {
  code: string;
  label: string;
  symbol: string;
}

function loadCurrency(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || "USD";
  } catch {
    return "USD";
  }
}

function saveCurrency(code: string) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch { /* noop */ }
}

export function useCurrency(
  products: { price: number; rates?: ProductRate[] }[],
) {
  const [currency, setCurrencyState] = useState<string>(loadCurrency);

  const setCurrency = useCallback((code: string) => {
    setCurrencyState(code);
    saveCurrency(code);
  }, []);

  const currencies = useMemo<CurrencyOption[]>(() => {
    const seen = new Set<string>(["USD"]);
    const list: CurrencyOption[] = [
      { code: "USD", label: "$ USD", symbol: "$" },
    ];
    for (const p of products) {
      for (const r of p.rates || []) {
        if (!seen.has(r.code)) {
          seen.add(r.code);
          const sym = getSymbol(r.code);
          list.push({ code: r.code, label: `${sym} ${r.code}`, symbol: sym });
        }
      }
    }
    return list;
  }, [products]);

  const currentRate = useMemo(() => {
    if (currency === "USD") return 1;
    const p = products.find((p) => p.rates?.length);
    if (!p) return 1;
    const rate = p.rates!.find((r) => r.code === currency);
    if (!rate || p.price <= 0) return 1;
    return rate.rate / p.price;
  }, [products, currency]);

  const rateMap = useMemo(() => {
    const map: Record<string, number> = { USD: 1 };
    for (const p of products) {
      for (const r of p.rates || []) {
        if (p.price > 0) map[r.code] = r.rate / p.price;
      }
    }
    return map;
  }, [products]);

  const symbol = getSymbol(currency);

  const exchangeRateText = useMemo(() => {
    if (currency === "USD" || currentRate <= 0) return null;
    return `1 USD = ${currentRate.toFixed(2)} ${currency}`;
  }, [currency, currentRate]);

  const cycleCurrency = useCallback(() => {
    const codes = currencies.map((c) => c.code);
    const idx = codes.indexOf(currency);
    const next = codes[(idx + 1) % codes.length];
    setCurrency(next);
  }, [currencies, currency, setCurrency]);

  return {
    currency,
    setCurrency,
    currencies,
    currentRate,
    rateMap,
    symbol,
    exchangeRateText,
    cycleCurrency,
  };
}
