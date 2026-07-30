import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { RxDatabase } from "rxdb";
import { RxDatabaseProvider, useLiveRxQuery } from "rxdb/plugins/react";

import { CartAside } from "../components/pos/CartAside";
import { MobileCartButton } from "../components/pos/MobileCartButton";
import { PaymentDialog } from "../components/pos/PaymentDialog";
import { PosToolbar } from "../components/pos/PosToolbar";
import { ProductGrid } from "../components/pos/ProductGrid";
import { ReceiptModal } from "../components/pos/ReceiptModal";
import { ReservationDialog } from "../components/pos/ReservationDialog";
import { useToast } from "../components/pos/Toast";
import { Loading } from "../components/ui";

import { useCurrency } from "../hooks/useCurrency";
import { useOrders } from "../hooks/useOrders";
import { usePayment } from "../hooks/usePayment";

import {
  getDatabase,
  type ProductDoc,
  type RxCollections,
} from "../lib/database";
import type { ProductWithCategory } from "../lib/types";
import {
  useKeyboardShortcuts,
  type ShortcutConfig,
} from "../lib/useKeyboardShortcuts";

// ─── Entrypoint ───────────────────────────────────────────────────────────────

export function PosPage() {
  const [db, setDb] = useState<RxDatabase<RxCollections> | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    getDatabase()
      .then(setDb)
      .catch((e) => setDbError(e?.message || "Error al iniciar DB"));
  }, []);

  if (dbError)
    return (
      <div className="flex h-dvh items-center justify-center p-4 text-center">
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
          {dbError}
        </p>
      </div>
    );
  if (!db) return <Loading spinner text="Cargando catálogo..." />;

  return (
    <RxDatabaseProvider database={db}>
      <PosPageContent />
    </RxDatabaseProvider>
  );
}

// ─── Main content ────────────────────────────────────────────────────────────

function PosPageContent() {
  const { toast } = useToast();

  // ── RxDB products ──
  const productLiveQuery = useMemo(
    () => ({
      collection: "products",
      query: {
        selector: { isActive: 1 },
        sort: [{ name: "asc" as const }],
      },
    }),
    [],
  );
  const { results: rxdbResults, loading: productsLoading } =
    useLiveRxQuery<ProductDoc>(productLiveQuery);

  const products = useMemo(
    () =>
      rxdbResults.map((p) => {
        const d = p.toJSON() as ProductDoc;
        return {
          ...d,
          category: d.categoryName ? { name: d.categoryName } : null,
        };
      }) as unknown as ProductWithCategory[],
    [rxdbResults],
  );

  useEffect(() => {
    if (rxdbResults.length > 0 && !navigator.onLine) {
      toast("Modo offline — catálogo sincronizado", "success");
    }
  }, [rxdbResults, toast]);

  // ── Hooks ──
  const currencyState = useCurrency(products);
  const {
    currency,
    setCurrency,
    currencies,
    currentRate,
    rateMap,
    symbol,
    exchangeRateText,
    cycleCurrency,
  } = currencyState;

  const orderState = useOrders(currency);
  const {
    orders,
    activeOrderId,
    activeOrder,
    itemCount,
    totalDisplay,
    addToCart,
    updateQuantity,
    addOrder,
    removeOrder,
    switchOrder,
    resetActiveOrder,
  } = orderState;

  const paymentState = usePayment({
    totalDisplay,
    currency,
    items: activeOrder.items,
    rateMap,
    onPaid: resetActiveOrder,
  });
  const {
    payDialog,
    setPayDialog,
    receiptSale,
    setReceiptSale,
    submitting,
    payments,
    paymentsTotal,
    paymentDiff,
    openPayDialog,
    addPaymentSplit,
    updatePayment,
    removePayment,
    mobilePaymentError,
    submitPayment,
  } = paymentState;

  // ── Search & filter ──
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(
    () =>
      [
        ...new Set(products.map((p) => p.category?.name).filter(Boolean)),
      ] as string[],
    [products],
  );

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase();
    return products
      .filter((p) => {
        const matchSearch =
          !search ||
          p.name.toLowerCase().includes(q) ||
          p.code?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q);
        const matchCategory =
          !selectedCategory || p.category?.name === selectedCategory;
        return matchSearch && matchCategory;
      })
      .map((p) => {
        if (p.productType === "combo" && !!p.comboItems) {
          const mapComboProducts = new Map(
            p.comboItems.map((sp) => [sp.componentProductId, sp.quantity]),
          );
          const maxCombos = products
            .filter((ip) => mapComboProducts.has(ip.id))
            .reduce((accumulator, currentValue) => {
              const required = mapComboProducts.get(currentValue.id);
              if (!required) return accumulator;

              const possible = Math.floor(currentValue.currentStock / required);
              if (possible < accumulator) return possible;

              return accumulator;
            }, Infinity);

          const currentStock = maxCombos === Infinity ? 0 : maxCombos;
          return { ...p, currentStock } as ProductWithCategory;
        }
        return p;
      });
  }, [products, search, selectedCategory]);

  // ── Reservation dialog state ──
  const [pendingReservation, setPendingReservation] = useState<{
    product: ProductWithCategory;
  } | null>(null);

  function handleAddToCart(product: ProductWithCategory) {
    if (product.productType === "reservation") {
      setPendingReservation({ product });
      return;
    }
    addToCart(product);
  }

  function handleReservationConfirm(data: {
    checkIn: string;
    checkOut: string;
    total: number;
  }) {
    if (!pendingReservation) return;
    addToCart(pendingReservation.product, {
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      total: data.total,
    });
    setPendingReservation(null);
  }

  // ── Keyboard shortcuts ──
  const shortcuts: ShortcutConfig[] = useMemo(
    () => [
      { key: "F1", action: openPayDialog, description: "Cobrar (F1)" },
      { key: "F2", action: addOrder, description: "Nueva orden (F2)" },
      {
        key: "F3",
        action: () => searchInputRef.current?.focus(),
        description: "Buscar producto (F3)",
      },
      { key: "F4", action: cycleCurrency, description: "Cambiar moneda (F4)" },
      {
        key: "Escape",
        action: () => {
          setPayDialog(false);
          setCartOpen(false);
        },
        description: "Cerrar modales (Esc)",
      },
      {
        key: "Delete",
        action: () => {
          if (activeOrder.items.length > 0 && !payDialog && !cartOpen)
            removeOrder(activeOrderId);
        },
        description: "Eliminar orden actual (Supr)",
      },
    ],
    [
      activeOrderId,
      activeOrder,
      payDialog,
      cartOpen,
      cycleCurrency,
      addOrder,
      removeOrder,
      openPayDialog,
    ],
  );

  useKeyboardShortcuts(shortcuts);

  // ── Render ──
  if (productsLoading) return <Loading spinner text="Cargando..." />;

  const cartAsideProps = {
    cartOpen,
    setCartOpen,
    orders,
    activeOrderId,
    itemCount,
    totalDisplay,
    symbol,
    currency,
    rate: currentRate,
    submitting,
    hasMultipleOrders: orders.length > 1,
    activeOrderEmpty: activeOrder.items.length === 0,
    onSwitchOrder: (id: number) => {
      switchOrder(id);
      setCartOpen(false);
    },
    onAddOrder: addOrder,
    onRemoveOrder: removeOrder,
    onOpenPay: openPayDialog,
    onUpdateQuantity: updateQuantity,
  };

  return (
    <>
      <div className="pos-layout">
        <main className="pos-main">
          <MobileCartButton
            orderName={activeOrder.name}
            symbol={symbol}
            total={totalDisplay}
            cartOpen={cartOpen}
            onClick={() => setCartOpen(true)}
          />
          <PosToolbar
            search={search}
            onSearch={setSearch}
            searchRef={searchInputRef}
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            currencies={currencies}
            currency={currency}
            onCurrencyChange={setCurrency}
            exchangeRateText={exchangeRateText}
          />
          <ProductGrid
            products={filteredProducts}
            currency={currency}
            symbol={symbol}
            onAddToCart={handleAddToCart}
          />
        </main>

        <CartAside mobile={false} {...cartAsideProps} />
        <CartAside mobile={true} {...cartAsideProps} />
      </div>

      <PaymentDialog
        open={payDialog}
        onClose={() => setPayDialog(false)}
        orderName={activeOrder.name}
        totalDisplay={totalDisplay}
        symbol={symbol}
        currency={currency}
        exchangeRateText={exchangeRateText}
        payments={payments}
        paymentsTotal={paymentsTotal}
        paymentDiff={paymentDiff}
        submitting={submitting}
        currencies={currencies}
        rateMap={rateMap}
        onUpdatePayment={updatePayment}
        onRemovePayment={removePayment}
        onAddPaymentSplit={addPaymentSplit}
        onSubmit={submitPayment}
        getMobileError={mobilePaymentError}
      />

      <ReservationDialog
        open={!!pendingReservation}
        product={pendingReservation?.product ?? null}
        onConfirm={handleReservationConfirm}
        onClose={() => setPendingReservation(null)}
      />

      {receiptSale && (
        <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} />
      )}
    </>
  );
}
