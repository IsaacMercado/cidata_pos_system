import { getCategoryIcon, priceInCurrency } from "../../lib/currency";
import type { ProductWithCategory } from "../../lib/types";

interface ProductGridProps {
  products: ProductWithCategory[];
  currency: string;
  symbol: string;
  onAddToCart: (product: ProductWithCategory) => void;
}

export function ProductGrid({ products, currency, symbol, onAddToCart }: ProductGridProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-3 py-2 pos-scrollbar">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            currency={currency}
            symbol={symbol}
            onAddToCart={onAddToCart}
          />
        ))}
        {products.length === 0 && (
          <p className="col-span-full text-center text-zinc-400 py-12 text-sm">Sin resultados</p>
        )}
      </div>
    </div>
  );
}

interface ProductCardProps {
  product: ProductWithCategory;
  currency: string;
  symbol: string;
  onAddToCart: (product: ProductWithCategory) => void;
}

function ProductCard({ product, currency, symbol, onAddToCart }: ProductCardProps) {
  const priceDisplay = priceInCurrency(product, currency);
  const Icon = getCategoryIcon(product.category?.name ?? "");

  // Show USD equivalent when viewing in another currency
  const showUsdEquiv = currency !== "USD";
  const usdPrice = product.price;

  return (
    <button
      onClick={() => onAddToCart(product)}
      disabled={product.currentStock <= 0}
      className="group flex flex-col items-center justify-center p-3 sm:p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-center hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md hover:shadow-indigo-100/50 dark:hover:shadow-indigo-900/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 min-h-[120px] sm:min-h-[140px]"
    >
      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
        <Icon size={20} className="text-indigo-500" />
      </div>

      <span className="text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-100 leading-tight line-clamp-2">
        {product.name}
      </span>

      {/* Primary price in selected currency */}
      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-1">
        {symbol}{priceDisplay.toFixed(2)}
      </span>

      {/* USD equivalent when viewing in another currency */}
      {showUsdEquiv && (
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          ${usdPrice.toFixed(2)} USD
        </span>
      )}

      {/* Stock */}
      <span className={`text-[10px] px-1.5 py-0.5 rounded mt-1 ${
        product.currentStock <= 0
          ? "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
          : product.currentStock <= 5
            ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30"
            : "text-zinc-400 dark:text-zinc-500"
      }`}>
        {product.currentStock > 0 ? `${product.currentStock} uds.` : "Agotado"}
      </span>
    </button>
  );
}
