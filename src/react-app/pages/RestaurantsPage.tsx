import { useEffect, useState } from "preact/hooks";
import type { RxDatabase } from "rxdb";
import { RxDatabaseProvider, useRxCollection } from 'rxdb/plugins/react';
import { useLocation, useRoute } from "wouter-preact";
import { SimplePaymentDialog as PaymentDialog } from "../components/pos/SimplePaymentDialog";
import { TableMap } from "../components/pos/TableMap";
import { TableOrderPanel } from "../components/pos/TableOrderPanel";
import { TablePicker } from "../components/pos/TablePicker";
import { useToast } from "../components/pos/Toast";
import { Button, Loading } from "../components/ui";
import { api } from "../lib/api";
import { getDatabase, type ProductDoc, type RestaurantDoc, type RestaurantTableDoc, type SaleDoc, type RxCollections } from '../lib/database';
import { useOnlineStatus } from "../lib/useOnlineStatus";

type DraftMap = Record<number, any[]>;

function localItems(items: any[], products: any[]) {
  return items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return { ...item, name: item.name || product?.name || `Prod #${item.productId}`, total: item.total ?? item.unitPrice * item.quantity };
  });
}

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
  const { toast } = useToast();

  const [restaurant, setRestaurant] = useState<any | null>(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(true);

  const [products, setProducts] = useState<any[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [planExpanded, setPlanExpanded] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [draftsByTable, setDraftsByTable] = useState<DraftMap>({});
  const [payDialog, setPayDialog] = useState(false);
  const [payments, setPayments] = useState<{ methodId: number; amount: string }[]>([]);
  const [paymentNote, setPaymentNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingTable, setLoadingTable] = useState(false);

  const restaurantCollection = useRxCollection<RestaurantDoc>("restaurants");
  const restaurantTableCollection = useRxCollection<RestaurantTableDoc>("restaurant_tables");
  const productsCollection = useRxCollection<ProductDoc>("products");

  useEffect(() => {
    void loadRestaurant();
    if (view === "order") void loadProducts();
  }, [view, online, restaurantCollection, restaurantTableCollection, productsCollection]);

  useEffect(() => {
    if (!restaurant || view !== "order") return;
    const tables = restaurant.tables || [];
    if (tables.length === 0) return;
    if (!selectedTableId || !tables.some((t: any) => t.id === selectedTableId)) {
      void selectTable(tables[0]);
    }
  }, [restaurant, view, selectedTableId]);

  async function loadRestaurant() {
    if (!restaurantCollection || !restaurantTableCollection) return;
    setLoadingRestaurant(true);
    try {
      const rows = await restaurantCollection.find({ selector: { isActive: 1 }, sort: [{ updatedAt: "desc" }] }).exec();
      let r = rows[0]?.toJSON() as any;
      if (!r && online) {
        const remote = await api.restaurants.list();
        r = remote[0];
      }
      if (!r) { setRestaurant(null); return; }
      let tables = await restaurantTableCollection.find({ selector: { restaurantId: r.id, isActive: 1 } }).exec();
      if (tables.length === 0 && online) {
        const remote = await api.restaurants.get(r.id);
        r = remote;
        tables = [];
        if (remote.tables?.length) {
          await restaurantTableCollection.bulkUpsert(remote.tables.map((table: any) => ({ ...table, rxid: String(table.id), _deleted: false })));
          tables = await restaurantTableCollection.find({ selector: { restaurantId: r.id, isActive: 1 } }).exec();
        }
      }
      setRestaurant({ ...r, tables: tables.map((t) => t.toJSON()) });
    } catch (error) {
      setRestaurant(null);
      toast(error instanceof Error ? error.message : "No se pudo cargar el restaurante", "error");
    } finally {
      setLoadingRestaurant(false);
    }
}

  async function loadProducts() {
    if (!productsCollection) { setProducts([]); return; }
    const rows = await productsCollection.find({ selector: { isActive: 1, catalogStatus: "active" } }).exec();
    setProducts(rows.map((r) => r.toJSON()));
}

function removeTable(tableId: number) {
  if (!restaurant || !confirm("¿Eliminar esta mesa?")) return;
  api.restaurants.removeTable(restaurant.id, tableId).then(() => loadRestaurant());
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

    try {
      const localSales = await getDatabase();
      const rows = await localSales.sales.find({ selector: { tableId: table.id, status: "in_progress" }, sort: [{ createdAt: "asc" }] }).exec();
      const localSale = rows[0]?.toJSON();
      if (localSale) {
        setActiveOrder(localSale);
        setSavedItems(localItems([...(localSale.items || [])], products));
      } else if (online) {
        const openSales = await api.sales.list({ tableId: table.id, status: "in_progress", limit: 1 });
        if (openSales.length > 0) {
          const sale = await api.sales.get(openSales[0].id);
          setActiveOrder(sale);
          setSavedItems(sale.items || []);
        } else {
          setActiveOrder(null);
          setSavedItems([]);
        }
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
    const newItems = draftItems.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice, discountPercent: item.discountPercent }));
    try {
      if (activeOrder && !activeOrder.rxid) {
        if (!online) throw new Error("Esta cuenta del servidor debe sincronizarse antes de agregar productos offline");
        const updated = await api.sales.addItems(activeOrder.id, { items: newItems });
        setActiveOrder(updated);
        setSavedItems(updated.items || []);
        clearDraftForTable(currentTable.id);
        return;
      }
      const db = await getDatabase();
      const now = new Date().toISOString();
      const clientId = activeOrder?.clientId || `table-${currentTable.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const items = activeOrder ? [...(activeOrder.items || []), ...newItems] : newItems;
      const subtotal = items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice * (1 - (item.discountPercent || 0) / 100), 0);
      const taxTotal = items.reduce((sum: number, item: any) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        return sum + (item.quantity * item.unitPrice * (1 - (item.discountPercent || 0) / 100) * (product?.taxRate || 0)) / 100;
      }, 0);
      const updated: SaleDoc = {
        rxid: activeOrder?.rxid || clientId, clientId, serverId: activeOrder?.serverId || null,
        customerId: null, userId: null, tableId: currentTable.id, tableName: currentTable.name,
        subtotal, taxTotal, discountTotal: 0, total: subtotal + taxTotal, status: "in_progress", notes: null,
        items, payments: [], syncStatus: "pending", receiptNumber: activeOrder?.receiptNumber || `LOCAL-${Date.now()}`,
        createdAt: activeOrder?.createdAt || now, updatedAt: now, _deleted: false,
      };
      if (activeOrder) await db.sales.upsert(updated);
      else await db.sales.insert(updated);
      setActiveOrder(updated);
      setSavedItems(localItems(updated.items || [], products));
      clearDraftForTable(currentTable.id);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error al guardar", "error");
    }
    setSubmitting(false);
  }

  function openPayDialog() {
    if (!activeOrder || draftItems.length > 0) return;
    setPayments([{ methodId: 1, amount: payableTotal.toFixed(2) }]);
    setPaymentNote("");
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
      if (!activeOrder.rxid) {
        if (!online) throw new Error("Esta cuenta del servidor debe sincronizarse antes de cobrar offline");
        await api.sales.pay(activeOrder.id, {
          payments: payments.map((payment) => ({ paymentMethodId: payment.methodId, amount: parseFloat(payment.amount) })),
          notes: paymentNote.trim() || undefined,
        });
        setPayDialog(false);
        setActiveOrder(null);
        setSavedItems([]);
        await selectTable(currentTable);
        return;
      }
      const db = await getDatabase();
      const target = await db.sales.findOne(activeOrder.rxid).exec();
      if (!target) throw new Error("La cuenta local ya no existe");
      await target.incrementalPatch({
        status: "completed",
         payments: payments.map((payment) => ({ paymentMethodId: payment.methodId, amount: parseFloat(payment.amount), currency: "USD" })),
         notes: paymentNote.trim() || null,
        syncStatus: "pending",
        updatedAt: new Date().toISOString(),
      });
      setPayDialog(false);
      setActiveOrder(null);
      setSavedItems([]);
      clearDraftForTable(currentTable.id);
      await selectTable(currentTable);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error al cobrar", "error");
    }
    setSubmitting(false);
  }

  const filteredProducts = productQuery
    ? products.filter((product: any) => product.name?.toLowerCase().includes(productQuery.toLowerCase()) || product.code?.toLowerCase().includes(productQuery.toLowerCase()))
    : products;

  if (loadingRestaurant) return <Loading text="Cargando restaurante..." />;
  if (!restaurant) return (
    <div className="mx-auto max-w-xl p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-800">Restaurante no configurado</h2>
      <p className="mt-2 text-sm text-slate-500">Configura el restaurante y sus mesas en Odoo, sincroniza el catálogo y vuelve a cargar esta pantalla.</p>
      {!online && <p className="mt-3 text-sm font-medium text-amber-700">Estás sin conexión y no hay una copia local disponible.</p>}
    </div>
  );

  if (view === "layout") {
    return (
      <TableMap
        restaurant={restaurant}
        onClose={() => navigate("/restaurants")}
        onAddTable={() => {}}
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
  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600">Sala de servicio</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{restaurant.name}</h2>
          <p className="mt-1 text-sm text-slate-500">Selecciona una mesa y gestiona su cuenta desde un solo lugar.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`hidden rounded-full px-3 py-2 text-xs font-semibold sm:inline-flex ${online ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{online ? "En línea" : "Modo offline"}</span>
          <Button variant="outline" size="sm" onClick={() => navigate("/restaurants/layout")}>Editar plano</Button>
        </div>
      </div>

      <PaymentDialog
        open={payDialog}
        onClose={() => setPayDialog(false)}
        total={payableTotal}
        currency="USD"
        rate={0}
        payments={payments}
        note={paymentNote}
        paymentsTotal={paymentsTotal}
        paymentDiff={paymentDiff}
        submitting={submitting}
        onAddPaymentSplit={addPaymentSplit}
        onUpdatePayment={updatePayment}
        onNoteChange={setPaymentNote}
        onRemovePayment={removePayment}
        onSubmitPayment={submitPayment}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
        <TablePicker
          tables={tables}
          selectedTableId={selectedTableId}
          draftsByTable={draftsByTable}
          onSelectTable={selectTable}
          getTableSummary={getTableSummary}
        />

        <TableOrderPanel
          currentTable={currentTable}
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
