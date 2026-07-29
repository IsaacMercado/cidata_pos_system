import { useCallback, useMemo, useState } from "preact/hooks";
import { getSymbol } from "../lib/currency";
import type { ProductRate } from "../lib/types";

export interface CurrencyOption {
  code: string;
  label: string;
  symbol: string;
}

export function useCurrency(
  products: { price: number; rates?: ProductRate[] }[],
) {
  const [currency, setCurrency] = useState<string>("USD");

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

  const symbol = getSymbol(currency);

  const exchangeRateText = useMemo(() => {
    if (currency === "USD" || currentRate <= 0) return null;
    return `1 USD = ${currentRate.toFixed(2)} ${currency}`;
  }, [currency, currentRate]);

  const cycleCurrency = useCallback(() => {
    const codes = currencies.map((c) => c.code);
    const idx = codes.indexOf(currency);
    setCurrency(codes[(idx + 1) % codes.length]);
  }, [currencies, currency]);

  return {
    currency,
    setCurrency,
    currencies,
    currentRate,
    symbol,
    exchangeRateText,
    cycleCurrency,
  };
}
