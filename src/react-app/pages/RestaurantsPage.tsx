import { useEffect, useRef, useState } from "preact/hooks";
import { SubmitHandler, useForm } from "react-hook-form";
import type { RxDatabase } from "rxdb";
import { RxDatabaseProvider, useRxCollection } from 'rxdb/plugins/react';
import { useLocation, useRoute } from "wouter-preact";
import { PaymentDialog } from "../components/pos/PaymentDialog";
import { TableMap } from "../components/pos/TableMap";
import { TableOrderPanel } from "../components/pos/TableOrderPanel";
import { TablePicker } from "../components/pos/TablePicker";
import { useToast } from "../components/pos/Toast";
import { Button, CardContent, CardHeader, CardTitle, Loading } from "../components/ui";
import { api } from "../lib/api";
import { getDatabase, type ProductDoc, type RestaurantDoc, type RestaurantTableDoc, type RxCollections } from '../lib/database';
import { useOnlineStatus } from "../lib/useOnlineStatus";

type TableShape = "circle" | "rectangle";
type TableForm = { name: string; capacity: number; shape: TableShape };
type DraftMap = Record<number, any[]>;

const colorByStatus: Record<string, string> = {
  available: "bg-emerald-500",
  occupied: "bg-rose-500",
  reserved: "bg-amber-500",
  maintenance: "bg-slate-400",
};

const labelByStatus: Record<string, string> = {
  available: "Libre",
  occupied: "En servicio",
  reserved: "Reservada",
  maintenance: "Mantenimiento",
};

export function RestaurantsPage() {
  const [db, setDb] = useState<RxDatabase<RxCollections> | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    getDatabase().then(setDb).catch((e) => setDbError(e?.message || "Error al iniciar DB"));
  }, []);

  if (dbError) return <div className="flex h-dvh items-center justify-center p-4 text-center"><p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{dbError}</p></div>;
  if (!db) return <Loading text="Cargando..." />;

  return (
    <RxDatabaseProvider database={db}>
      <RestaurantsPageContent />
    </RxDatabaseProvider>
  );
}

function RestaurantsPageContent() {
  const [, params] = useRoute("/restaurants/:view?");
  const [, navigate] = useLocation();
  const online = useOnlineStatus();
  const view = params?.view === "layout" ? "layout" : "order";

  const [restaurant, setRestaurant] = useState<any | null>(null);
  const [showTableForm, setShowTableForm] = useState(false);
  const tableForm = useForm<TableForm>({ defaultValues: { name: "", capacity: 2, shape: "circle" } });
  const [products, setProducts] = useState<any[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [planExpanded, setPlanExpanded] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [draftsByTable, setDraftsByTable] = useState<DraftMap>({});
  const [payDialog, setPayDialog] = useState(false);
  const [payments, setPayments] = useState<{ methodId: number; amount: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingTable, setLoadingTable] = useState(false);
  const { toast } = useToast();
  const [dragging, setDragging] = useState<number | null>(null);
  const dragRef = useRef({ startX: 0, startY: 0, tableId: 0 });

  const restaurantCollection = useRxCollection<RestaurantDoc>("restaurants");
  const restaurantTableCollection = useRxCollection<RestaurantTableDoc>("restaurant_tables");
  const productsCollection = useRxCollection<ProductDoc>("products");

  useEffect(() => {
    void loadRestaurant();
    if (view === "order") void loadProducts();
  }, [view, online]);

  useEffect(() => {
    if (!restaurant || view !== "order") return;
    const tables = restaurant.tables || [];
    if (tables.length === 0) return;
    if (!selectedTableId || !tables.some((t: any) => t.id === selectedTableId)) {
      void selectTable(tables[0]);
    }
  }, [restaurant, view, selectTable, selectedTableId]);

  async function loadRestaurant() {
    if (!restaurantCollection || !restaurantTableCollection) { setRestaurant(null); return; }
    const rows = await restaurantCollection.find().exec();
    const first = rows[0];
    if (!first) { setRestaurant(null); return; }
    const r = first.toJSON();
    const tables = await restaurantTableCollection.find({ selector: { restaurantId: r.id } }).exec();
    setRestaurant({ ...r, tables: tables.map((t) => t.toJSON()) });
  }

  async function loadProducts() {
    if (!productsCollection) { setProducts([]); return; }
    const rows = await productsCollection.find({ selector: { isActive: 1 } }).exec();
    setProducts(rows.map((r) => r.toJSON()));
  }

  const onSaveTable: SubmitHandler<TableForm> = async (data) => {
    if (!restaurant) return;
    await api.restaurants.addTable(restaurant.id, data);
    setShowTableForm(false);
    tableForm.reset({ name: "", capacity: 2, shape: "circle" });
    await loadRestaurant();
  };

  async function removeTable(tableId: number) {
    if (!restaurant || !confirm("¿Eliminar esta mesa?")) return;
    await api.restaurants.removeTable(restaurant.id, tableId);
    await loadRestaurant();
  }

  function setDraftForTable(tableId: number, updater: (items: any[]) => any[]) {
    setDraftsByTable((prev) => ({ ...prev, [tableId]: updater(prev[tableId] || []) }));
  }

  function clearDraftForTable(tableId: number) {
    setDraftsByTable((prev) => ({ ...prev, [tableId]: [] }));
  }

  async function selectTable(table: any) {
    setSelectedTableId(table.id);
    setPayDialog(false);
    setPlanExpanded(false);
    setLoadingTable(true);

    if (!online) {
      setActiveOrder(null);
      setSavedItems([]);
      setLoadingTable(false);
      return;
    }

    try {
      const openSales = await api.sales.list({ tableId: table.id, status: "in_progress", limit: 1 });
      if (openSales.length > 0) {
        const sale = await api.sales.get(openSales[0].id);
        setActiveOrder(sale);
        setSavedItems(sale.items || []);
      } else {
        setActiveOrder(null);
        setSavedItems([]);
      }
    } catch {
      setActiveOrder(null);
      setSavedItems([]);
    }
    setLoadingTable(false);
  }

  const currentTable = restaurant?.tables?.find((t: any) => t.id === selectedTableId) || null;
  const draftItems = currentTable ? draftsByTable[currentTable.id] || [] : [];
  const allOrderItems = [...savedItems, ...draftItems];
  const orderTotal = allOrderItems.reduce((sum, item) => sum + item.total, 0);
  const payableTotal = activeOrder?.total ?? orderTotal;

  function getTableSummary(table: any) {
    const draftItemsForTable = draftsByTable[table.id] || [];
    const draftTotal = draftItemsForTable.reduce((sum, item) => sum + item.total, 0);
    const isActive = currentTable?.id === table.id;
    const activeTotal = isActive ? payableTotal : 0;
    const backendOpenTotal = table.openTotal || 0;
    const total = activeTotal > 0 ? activeTotal : backendOpenTotal > 0 ? backendOpenTotal : draftTotal;
    const itemsCount = draftItemsForTable.length;
    return { total, itemsCount, hasOpenOrder: Boolean(table.openSaleId), receiptNumber: table.openReceiptNumber as string | null };
  }

  function renderPlanButton(table: any, expanded = false) {
    const isSelected = table.id === selectedTableId;
    const summary = getTableSummary(table);
    const width = expanded ? Math.max(table.width + 18, 86) : table.width;
    const height = table.shape === "circle" ? width : (expanded ? Math.max(table.height + 12, 72) : table.height);

    return (
      <button
        key={table.id}
        className={`absolute flex cursor-grab flex-col items-center justify-center text-white shadow-lg transition ${table.shape === "circle" ? "rounded-full" : "rounded-2xl"} ${colorByStatus[table.status] || "bg-emerald-500"} ${isSelected ? "ring-4 ring-violet-200" : "hover:ring-2 hover:ring-violet-300"} ${dragging === table.id ? "scale-105 opacity-80" : ""}`}
        style={{ left: table.posX, top: table.posY, width, height }}
        onClick={() => void selectTable(table)}
        onMouseDown={(e) => onDragStart(e, table)}
      >
        <div className="pointer-events-none text-center leading-tight">
          <div className={`${expanded ? "text-xs" : "text-xs"} font-bold`}>{table.name}</div>
          <div className={`${expanded ? "text-xs" : "text-xs"} opacity-80`}>{table.capacity} pax</div>
          {summary.total > 0 && <div className={`${expanded ? "text-xs" : "text-xs"} font-semibold opacity-95`}>${summary.total.toFixed(2)}</div>}
          {summary.itemsCount > 0 && <div className="text-xs opacity-90">+{summary.itemsCount} nuevos</div>}
        </div>
      </button>
    );
  }

  function addToDraft(product: any) {
    if (!currentTable) return;
    setDraftForTable(currentTable.id, (prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) => item.productId === product.id
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice }
          : item);
      }
      return [...prev, { productId: product.id, code: product.code, name: product.name, quantity: 1, unitPrice: product.price, total: product.price, discountPercent: 0 }];
    });
  }

  function updateDraftQty(index: number, quantity: number) {
    if (!currentTable) return;
    setDraftForTable(currentTable.id, (prev) => prev.map((item, idx) => (
      idx === index ? { ...item, quantity: Math.max(0.001, quantity), total: Math.max(0.001, quantity) * item.unitPrice } : item
    )));
  }

  function removeDraftItem(index: number) {
    if (!currentTable) return;
    setDraftForTable(currentTable.id, (prev) => prev.filter((_, idx) => idx !== index));
  }

  async function saveOrder() {
    if (!currentTable || draftItems.length === 0 || submitting) return;
    setSubmitting(true);
    const payload = {
      items: draftItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
      })),
    };
    try {
      let updated;
      if (activeOrder) updated = await api.sales.addItems(activeOrder.id, payload);
      else updated = await api.sales.create({ ...payload, tableId: currentTable.id, status: "in_progress" });
      setActiveOrder(updated);
      setSavedItems(updated.items || []);
      clearDraftForTable(currentTable.id);
      await loadRestaurant();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error al guardar", "error");
    }
    setSubmitting(false);
  }

  function openPayDialog() {
    if (!activeOrder || draftItems.length > 0) return;
    setPayments([{ methodId: 1, amount: payableTotal.toFixed(2) }]);
    setPayDialog(true);
  }

  function addPaymentSplit() {
    const remaining = payableTotal - payments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
    if (remaining > 0.01) setPayments((prev) => [...prev, { methodId: 2, amount: remaining.toFixed(2) }]);
  }

  function updatePayment(index: number, field: "methodId" | "amount", value: string | number) {
    setPayments((prev) => prev.map((payment, idx) => idx === index ? { ...payment, [field]: value } : payment));
  }

  function removePayment(index: number) {
    setPayments((prev) => prev.filter((_, idx) => idx !== index));
  }

  const paymentsTotal = payments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
  const paymentDiff = payableTotal - paymentsTotal;

  async function submitPayment() {
    if (!activeOrder || !currentTable || Math.abs(paymentDiff) > 0.009 || submitting) return;
    setSubmitting(true);
    try {
      await api.sales.pay(activeOrder.id, {
        payments: payments.map((payment) => ({
          paymentMethodId: payment.methodId,
          amount: parseFloat(payment.amount),
        })),
      });
      setPayDialog(false);
      setActiveOrder(null);
      setSavedItems([]);
      clearDraftForTable(currentTable.id);
      await loadRestaurant();
      await selectTable(currentTable);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error al cobrar", "error");
    }
    setSubmitting(false);
  }

  function onDragStart(e: React.MouseEvent<HTMLDivElement>, table: any) {
    e.preventDefault();
    dragRef.current = { startX: e.clientX - table.posX, startY: e.clientY - table.posY, tableId: table.id };
    setDragging(table.id);

    const onMove = (ev: MouseEvent) => {
      if (!restaurant) return;
      const posX = Math.max(0, ev.clientX - dragRef.current.startX);
      const posY = Math.max(0, ev.clientY - dragRef.current.startY);
      setRestaurant({ ...restaurant, tables: (restaurant.tables || []).map((item: any) => item.id === dragRef.current.tableId ? { ...item, posX, posY } : item) });
    };

    const onUp = async (ev: MouseEvent) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setDragging(null);
      if (!restaurant) return;
      const posX = Math.max(0, ev.clientX - dragRef.current.startX);
      const posY = Math.max(0, ev.clientY - dragRef.current.startY);
      await api.restaurants.updateTable(restaurant.id, dragRef.current.tableId, { posX, posY });
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const filteredProducts = productQuery
    ? products.filter((product: any) => product.name?.toLowerCase().includes(productQuery.toLowerCase()) || product.code?.toLowerCase().includes(productQuery.toLowerCase()))
    : products;

  if (!restaurant) return <div className="py-10 text-sm text-slate-500">Cargando restaurante...</div>;

  if (view === "layout") {
    return (
      <TableMap
        restaurant={restaurant}
        onClose={() => navigate("/restaurants")}
        onAddTable={() => { tableForm.reset({ name: `Mesa ${(restaurant.tables || []).length + 1}`, capacity: 2, shape: "circle" }); setShowTableForm(true); }}
        onRemoveTable={removeTable}
        onUpdateTablePosition={async (tableId, posX, posY) => { await api.restaurants.updateTable(restaurant.id, tableId, { posX, posY }); await loadRestaurant(); }}
        onSelectTable={selectTable}
        selectedTableId={selectedTableId}
        draftsByTable={draftsByTable}
        expanded={planExpanded}
        setExpanded={setPlanExpanded}
      />
    );
  }

  const tables = restaurant.tables || [];
  const currentDraftCount = currentTable ? draftItems.length : 0;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{restaurant.name}</h2>
          <p className="text-sm text-slate-500">Selecciona una mesa, agrega productos y vuelve cuando quieras.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/restaurants/layout")}>Editar plano</Button>
      </div>

      <PaymentDialog
        open={payDialog}
        onClose={() => setPayDialog(false)}
        total={payableTotal}
        currency="USD"
        rate={0}
        payments={payments}
        paymentsTotal={paymentsTotal}
        paymentDiff={paymentDiff}
        submitting={submitting}
        onAddPaymentSplit={addPaymentSplit}
        onUpdatePayment={updatePayment}
        onRemovePayment={removePayment}
        onSubmitPayment={submitPayment}
      />

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_340px]">
        <TablePicker
          tables={tables}
          selectedTableId={selectedTableId}
          draftsByTable={draftsByTable}
          onSelectTable={selectTable}
          getTableSummary={getTableSummary}
        />

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
          <CardHeader className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{currentTable ? currentTable.name : "Selecciona una mesa"}</CardTitle>
              <p className="text-sm text-slate-500">{currentTable ? `${labelByStatus[currentTable.status] || currentTable.status} · ${currentTable.capacity} personas` : "Elige una mesa para cargar productos."}</p>
            </div>
            {currentTable && (
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                {activeOrder ? `Orden abierta ${activeOrder.receiptNumber}` : currentDraftCount > 0 ? "Borrador local" : currentTable.openReceiptNumber ? `Orden abierta ${currentTable.openReceiptNumber}` : "Sin orden"}
              </div>
            )}
          </CardHeader>

          <div className="relative mb-4">
            <svg className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-9 pr-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
              placeholder="Buscar productos para la mesa..."
              value={productQuery}
              onInput={(e: any) => setProductQuery(e.target.value)}
            />
          </div>

          {!currentTable && (
            <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
              Selecciona una mesa para empezar a cargar la cuenta.
            </div>
          )}

          {currentTable && (
            <CardContent className="pb-0">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
                {filteredProducts.map((product: any) => (
                  <button
                    key={product.id}
                    className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-violet-300 hover:shadow-sm disabled:opacity-40"
                    onClick={() => addToDraft(product)}
                    disabled={product.currentStock <= 0 || loadingTable}
                  >
                    <div className="mb-2 truncate text-sm font-semibold">{product.name}</div>
                    <div className="text-lg font-bold text-violet-700">${product.price.toFixed(2)}</div>
                    <div className="mt-2 text-[0.7rem] text-slate-400">Stock {product.currentStock} {product.unit}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          )}
        </section>

        <TableOrderPanel
          currentTable={currentTable}
          restaurant={restaurant}
          activeOrder={activeOrder}
          draftItems={draftItems}
          savedItems={savedItems}
          onAddToDraft={addToDraft}
          onUpdateDraftQty={updateDraftQty}
          onRemoveDraftItem={removeDraftItem}
          onSaveOrder={saveOrder}
          onOpenPayDialog={openPayDialog}
          onClearDraft={() => currentTable && clearDraftForTable(currentTable.id)}
          submitting={submitting}
          filteredProducts={filteredProducts}
          loadingTable={loadingTable}
          productQuery={productQuery}
          setProductQuery={setProductQuery}
        />
      </div>
    </div>
  );
}


