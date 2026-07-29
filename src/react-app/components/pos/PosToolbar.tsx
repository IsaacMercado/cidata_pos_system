import { Database, RefreshCw, Search } from "lucide-react";
import { resetDatabase } from "../../lib/database";
import type { CurrencyOption } from "../../hooks/useCurrency";

interface PosToolbarProps {
  search: string;
  onSearch: (s: string) => void;
  searchRef: any;
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (c: string) => void;
  currencies: CurrencyOption[];
  currency: string;
  onCurrencyChange: (c: string) => void;
  exchangeRateText: string | null;
}

export function PosToolbar({
  search,
  onSearch,
  searchRef,
  categories,
  selectedCategory,
  onSelectCategory,
  currencies,
  currency,
  onCurrencyChange,
  exchangeRateText,
}: PosToolbarProps) {
  return (
    <div className="sticky top-0 z-10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800 px-3 pt-3 pb-2 space-y-2 flex-shrink-0">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
            <Search size={16} />
          </span>
          <input
            ref={searchRef}
            type="text"
            placeholder="Buscar producto..."
            value={search}
            onInput={(e: any) => onSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-400 focus:bg-white dark:focus:bg-zinc-900 transition-colors"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e: any) => onSelectCategory(e.target.value)}
          className="px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition-colors max-w-[45%] md:max-w-none flex-shrink-0"
        >
          <option value="">Todas</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        {exchangeRateText && <span>Tasa: {exchangeRateText}</span>}
        {currencies.map((c) => (
          <button
            key={c.code}
            onClick={() => onCurrencyChange(c.code)}
            className={`px-2 py-0.5 rounded font-medium transition-colors ${
              currency === c.code
                ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            }`}
          >
            {c.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={async () => {
              if (!window.confirm("¿Está seguro de que desea restaurar la base de datos? Se perderán todos los datos locales y se volverá a sincronizar desde el servidor.")) return;
              await resetDatabase();
              location.reload();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Restaurar DB — Limpia la base de datos local y vuelve a sincronizar desde el servidor"
          >
            <Database size={16} />
          </button>
          <button
            onClick={() => location.reload()}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            title="Sincronizar — Recarga la página para forzar la sincronización con el servidor"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
