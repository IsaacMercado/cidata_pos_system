import { useEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import { SubmitHandler, useForm } from "react-hook-form";
import { useLocation, useRoute } from "wouter-preact";
import { api } from "../lib/api";
import {
  cacheProducts,
  cacheRestaurantTables,
  cacheRestaurants,
  getCachedProducts,
  getCachedRestaurant,
  getCachedRestaurants,
  getCachedTables,
} from "../lib/db";
import { paymentMethods } from "../lib/paymentMethods";
import { useOnlineStatus } from "../lib/useOnlineStatus";
import { useToast } from "../components/pos/Toast";
import { Button, Card } from "../components/ui";

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

function buildEmptyRestaurant(id: number) {
  return { id, name: "", description: "", tables: [] as any[] };
}

export function RestaurantsPage() {
  const [, params] = useRoute("/restaurants/:id/:view?");
  const [, navigate] = useLocation();
  const online = useOnlineStatus();
  const editingId = params?.id ? Number(params.id) : null;
  const view = params?.view === "layout" ? "layout" : editingId ? "order" : "list";

  const [list, setList] = useState<any[]>([]);
  const [restaurant, setRestaurant] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showTableForm, setShowTableForm] = useState(false);
  const restForm = useForm<{ name: string; description: string }>({
    defaultValues: { name: "", description: "" },
  });
  const tableForm = useForm<TableForm>({
    defaultValues: { name: "", capacity: 2, shape: "circle" },
  });
  const [products, setProducts] = useState<any[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [tablePickerView, setTablePickerView] = useState<"list" | "plan">("list");
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

  useEffect(() => {
    if (editingId) {
      void loadRestaurant(editingId);
      if (view === "order") void loadProducts();
      return;
    }
    void loadList();
  }, [editingId, view, online]);

  useEffect(() => {
    if (!restaurant || view !== "order") return;
    const tables = restaurant.tables || [];
    if (tables.length === 0) return;
    if (!selectedTableId || !tables.some((t: any) => t.id === selectedTableId)) {
      void selectTable(tables[0]);
    }
  }, [restaurant, view]);

  async function loadList() {
    if (online) {
      try {
        const data = await api.restaurants.list();
        await cacheRestaurants(data);
        setList(data);
        return;
      } catch {}
    }
    setList(await getCachedRestaurants());
  }

  async function loadRestaurant(id: number) {
    if (online) {
      try {
        const data = await api.restaurants.get(id);
        await cacheRestaurants([{ id: data.id, name: data.name, description: data.description }]);
        await cacheRestaurantTables(id, data.tables || []);
        setRestaurant(data);
        return;
      } catch {}
    }

    const cachedRestaurant = await getCachedRestaurant(id);
    const tables = await getCachedTables(id);
    setRestaurant(cachedRestaurant ? { ...cachedRestaurant, tables } : { ...buildEmptyRestaurant(id), tables });
  }

  async function loadProducts() {
    if (online) {
      try {
        const data = await api.products.list({});
        await cacheProducts(data);
        setProducts(data);
        return;
      } catch {}
    }
    setProducts(await getCachedProducts());
  }

  const onSaveRestaurant: SubmitHandler<{ name: string; description: string }> = async (data) => {
    if (editingId) await api.restaurants.update(editingId, data);
    else await api.restaurants.create(data);
    setShowForm(false);
    restForm.reset();
    if (editingId) void loadRestaurant(editingId);
    else void loadList();
  }

  const onSaveTable: SubmitHandler<TableForm> = async (data) => {
    if (!restaurant) return;
    await api.restaurants.addTable(restaurant.id, data);
    setShowTableForm(false);
    tableForm.reset({ name: "", capacity: 2, shape: "circle" });
    await loadRestaurant(restaurant.id);
  }

  async function removeTable(tableId: number) {
    if (!restaurant || !confirm("¿Eliminar esta mesa?")) return;
    await api.restaurants.removeTable(restaurant.id, tableId);
    await loadRestaurant(restaurant.id);
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
    return {
      total,
      itemsCount,
      hasOpenOrder: Boolean(table.openSaleId),
      receiptNumber: table.openReceiptNumber as string | null,
    };
  }

  function renderPlanButton(table: any, expanded = false) {
    const isSelected = table.id === selectedTableId;
    const summary = getTableSummary(table);
    const width = expanded ? Math.max(table.width + 18, 86) : table.width;
    const height = table.shape === "circle" ? width : (expanded ? Math.max(table.height + 12, 72) : table.height);

    return (
      <button
        key={table.id}
        className={`absolute flex items-center justify-center text-white shadow-lg transition ${table.shape === "circle" ? "rounded-full" : "rounded-2xl"} ${colorByStatus[table.status] || "bg-emerald-500"} ${isSelected ? "ring-4 ring-violet-200" : "hover:ring-2 hover:ring-violet-300"}`}
        style={{
          left: table.posX,
          top: table.posY,
          width,
          height,
        }}
        onClick={() => void selectTable(table)}
      >
        <div className="pointer-events-none text-center leading-tight">
          <div className={`${expanded ? "text-xs" : "text-[0.7rem]"} font-bold`}>{table.name}</div>
          <div className={`${expanded ? "text-[0.7rem]" : "text-[0.6rem]"} opacity-90`}>{table.capacity} pax</div>
          {summary.total > 0 && <div className={`${expanded ? "text-[0.7rem]" : "text-[0.55rem]"} font-semibold opacity-95`}>${summary.total.toFixed(2)}</div>}
          {summary.itemsCount > 0 && <div className="text-[0.55rem] opacity-90">+{summary.itemsCount} nuevos</div>}
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
      return [...prev, {
        productId: product.id,
        code: product.code,
        name: product.name,
        quantity: 1,
        unitPrice: product.price,
        total: product.price,
        discountPercent: 0,
      }];
    });
  }

  function updateDraftQty(index: number, quantity: number) {
    if (!currentTable) return;
    setDraftForTable(currentTable.id, (prev) => prev.map((item, idx) => (
      idx === index
        ? { ...item, quantity: Math.max(0.001, quantity), total: Math.max(0.001, quantity) * item.unitPrice }
        : item
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
      await loadRestaurant(currentTable.restaurantId);
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
      await loadRestaurant(currentTable.restaurantId);
      await selectTable(currentTable);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error al cobrar", "error");
    }
    setSubmitting(false);
  }

  function onDragStart(e: JSX.TargetedMouseEvent<HTMLDivElement>, table: any) {
    e.preventDefault();
    dragRef.current = { startX: e.clientX - table.posX, startY: e.clientY - table.posY, tableId: table.id };
    setDragging(table.id);

    const onMove = (ev: globalThis.MouseEvent) => {
      if (!restaurant) return;
      const posX = Math.max(0, ev.clientX - dragRef.current.startX);
      const posY = Math.max(0, ev.clientY - dragRef.current.startY);
      setRestaurant({
        ...restaurant,
        tables: (restaurant.tables || []).map((item: any) => item.id === dragRef.current.tableId ? { ...item, posX, posY } : item),
      });
    };

    const onUp = async (ev: globalThis.MouseEvent) => {
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

  if (!editingId) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Restaurantes</h2>
            <p className="text-sm text-slate-500">Administra salones y abre el mapa de mesas.</p>
          </div>
          <Button
            variant={showForm ? "ghost" : "accent"}
            onClick={() => setShowForm((value) => !value)}
          >
            {showForm ? "Cancelar" : "Nuevo restaurante"}
          </Button>
        </div>

        {showForm && (
          <form className="mb-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-[0_20px_45px_rgba(15,23,42,0.08)]" onSubmit={restForm.handleSubmit(onSaveRestaurant)}>
            <div className="space-y-3">
              <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500" placeholder="Nombre" {...restForm.register("name", { required: true })} />
              <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500" placeholder="Descripción" {...restForm.register("description")} />
            </div>
            <Button variant="accent" className="mt-3 w-full">Guardar</Button>
          </form>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((item: any) => (
            <Card key={item.id}>
              <div className="mb-4">
                <h3 className="font-semibold text-slate-900">{item.name}</h3>
                <p className="text-sm text-slate-500">{item.description || "Sin descripción"}</p>
              </div>
              <div className="flex gap-2">
                <a href={`/restaurants/${item.id}/order`} className="rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-3 py-2 text-sm font-medium text-white">Abrir mesas</a>
                <a href={`/restaurants/${item.id}/layout`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">Diseño</a>
              </div>
            </Card>
          ))}
          {list.length === 0 && <div className="py-12 text-center text-sm text-slate-400">Crea un restaurante para empezar.</div>}
        </div>
      </div>
    );
  }

  if (!restaurant) return <div className="py-10 text-sm text-slate-500">Cargando restaurante...</div>;

  if (view === "layout") {
    const tables = restaurant.tables || [];
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button className="mb-2 text-sm font-medium text-violet-700" onClick={() => navigate("/restaurants")}>Mesas</button>
            <h2 className="text-xl font-bold text-slate-900">{restaurant.name}</h2>
            <p className="text-sm text-slate-500">Editor de plano del salón.</p>
          </div>
          <div className="flex gap-2">
            <a href={`/restaurants/${restaurant.id}/order`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">Servicio</a>
            <Button variant="accent" size="sm" onClick={() => { tableForm.reset({ name: `Mesa ${tables.length + 1}`, capacity: 2, shape: "circle" }); setShowTableForm(true); }}>Nueva mesa</Button>
          </div>
        </div>

        {showTableForm && (
          <form className="mb-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-cyan-50 p-4" onSubmit={tableForm.handleSubmit(onSaveTable)}>
            <div className="grid gap-3 md:grid-cols-2">
              <input className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500" placeholder="Nombre" {...tableForm.register("name", { required: true })} />
              <input className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500" type="number" min="1" {...tableForm.register("capacity", { required: true, valueAsNumber: true })} />
            </div>
            <div className="mt-3 flex gap-2">
              {(["circle", "rectangle"] as const).map((shape) => (
                <label key={shape} className={`rounded-xl border px-3 py-2 text-sm cursor-pointer ${tableForm.watch("shape") === shape ? "border-violet-500 bg-white text-violet-700" : "border-slate-200 bg-white text-slate-600"}`}>
                  <input className="sr-only" type="radio" value={shape} {...tableForm.register("shape")} />
                  {shape === "circle" ? "Redonda" : "Rectangular"}
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="accent">Guardar mesa</Button>
              <Button variant="outline" type="button" onClick={() => setShowTableForm(false)}>Cancelar</Button>
            </div>
          </form>
        )}

        <Card className="mb-4">
          <div className="flex items-center gap-4 border-b border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-emerald-500" /> Libre</span>
            <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-rose-500" /> En servicio</span>
            <span className="ml-auto">Arrastra para reorganizar mesas</span>
          </div>
          <div className="relative min-h-[420px] overflow-auto p-4">
            {tables.map((table: any) => (
              <div
                key={table.id}
                className={`absolute flex cursor-grab flex-col items-center justify-center text-white shadow-lg ${table.shape === "circle" ? "rounded-full" : "rounded-2xl"} ${colorByStatus[table.status] || "bg-emerald-500"} ${dragging === table.id ? "scale-105 opacity-80" : "hover:ring-2 hover:ring-violet-400"}`}
                style={{ left: table.posX, top: table.posY, width: table.width, height: table.shape === "circle" ? table.width : table.height }}
                onMouseDown={(e) => onDragStart(e, table)}
              >
                <span className="text-xs font-bold">{table.name}</span>
                <span className="text-[0.65rem] opacity-80">{table.capacity} pax</span>
                {!!table.openTotal && <span className="text-[0.55rem] font-semibold opacity-95">${Number(table.openTotal).toFixed(2)}</span>}
              </div>
            ))}
            {tables.length === 0 && <div className="flex h-[380px] items-center justify-center text-sm text-slate-400">Crea la primera mesa para este salón.</div>}
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">Mesas del salón</div>
          {tables.map((table: any) => (
            <div key={table.id} className="flex items-center gap-3 border-b border-slate-50 px-4 py-3 last:border-b-0">
              <span className={`size-2.5 rounded-full ${colorByStatus[table.status] || "bg-emerald-500"}`} />
              <div className="flex-1">
                <div className="font-medium text-slate-900">{table.name}</div>
                <div className="text-xs text-slate-500">{labelByStatus[table.status] || table.status} · {table.capacity} personas</div>
              </div>
              <Button variant="danger" size="sm" onClick={() => removeTable(table.id)}>Eliminar</Button>
            </div>
          ))}
        </Card>
      </div>
    );
  }

  const tables = restaurant.tables || [];
  const currentDraftCount = currentTable ? draftItems.length : 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <button className="mb-2 text-sm font-medium text-violet-700" onClick={() => navigate("/restaurants")}>Mesas</button>
          <h2 className="text-xl font-bold text-slate-900">{restaurant.name}</h2>
          <p className="text-sm text-slate-500">Selecciona una mesa, agrega productos y vuelve cuando quieras.</p>
        </div>
        <a href={`/restaurants/${restaurant.id}/layout`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">Editar plano</a>
      </div>

      {payDialog && currentTable && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/45 p-3 sm:items-center">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Cobrar {currentTable.name}</h3>
                <p className="text-sm text-slate-500">Combina efectivo, tarjeta o transferencia en la misma cuenta.</p>
              </div>
              <button className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100" onClick={() => setPayDialog(false)}>Cerrar</button>
            </div>

            <div className="mb-3 rounded-2xl bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Total de la cuenta</span>
                <span className="text-xl font-bold text-slate-900">${payableTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3">
              {payments.map((payment, index) => (
                <div key={index} className="grid grid-cols-[1fr_120px_auto] items-center gap-3 rounded-2xl border border-slate-200 p-3">
                  <select className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500" value={payment.methodId} onChange={(e: any) => updatePayment(index, "methodId", parseInt(e.target.value))}>
                    {paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
                  </select>
                  <input className="rounded-xl border border-slate-300 px-3 py-2 text-right text-sm outline-none focus:border-violet-500" type="number" min="0.01" step="0.01" value={payment.amount} onInput={(e: any) => updatePayment(index, "amount", e.target.value)} />
                  <button className="rounded-lg px-2 py-1 text-sm text-red-500 hover:bg-red-50" onClick={() => removePayment(index)} disabled={payments.length === 1}>Quitar</button>
                </div>
              ))}
            </div>

            <button className="mt-3 w-full rounded-xl border border-dashed border-violet-300 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50" onClick={addPaymentSplit} disabled={paymentDiff <= 0.01}>Agregar otra forma de pago</button>

            <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Pagado</span>
                <span className="font-semibold text-slate-900">${paymentsTotal.toFixed(2)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-slate-500">Diferencia</span>
                <span className={`font-semibold ${Math.abs(paymentDiff) < 0.009 ? "text-emerald-600" : "text-rose-600"}`}>{Math.abs(paymentDiff) < 0.009 ? "Cuadrado" : `$${Math.abs(paymentDiff).toFixed(2)}`}</span>
              </div>
            </div>

            <button className="mt-4 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-base font-semibold text-white disabled:opacity-50" onClick={submitPayment} disabled={submitting || Math.abs(paymentDiff) > 0.009}>
              {submitting ? "Procesando..." : `Confirmar cobro de $${payableTotal.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}

      {planExpanded && (
        <div className="fixed inset-0 z-30 bg-slate-950/30 p-4" onMouseLeave={() => setPlanExpanded(false)}>
          <div className="mx-auto flex h-full max-w-7xl flex-col rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Plano completo</h3>
                <p className="text-sm text-slate-500">Selecciona una mesa desde el salón completo.</p>
              </div>
              <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700" onClick={() => setPlanExpanded(false)}>Cerrar</button>
            </div>
            <div className="mb-3 flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-500" /> Libre</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-rose-500" /> En servicio</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-amber-500" /> Reservada</span>
            </div>
            <div className="relative min-h-0 flex-1 overflow-auto rounded-3xl border border-slate-200 bg-slate-50/80 p-6">
              <div className="relative h-[900px] min-w-[1200px]">
                {tables.map((table: any) => renderPlanButton(table, true))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_340px]">
        <aside className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-[0_20px_45px_rgba(15,23,42,0.08)]" style="align-self: start;">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Mesas</h3>
              <p className="text-xs text-slate-500">Cambia entre lista y plano para elegir la mesa.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">{tables.length}</span>
          </div>
          <div className="mb-3 grid grid-cols-2 rounded-2xl bg-slate-100 p-1 text-xs font-medium">
            <button
              className={`rounded-xl px-3 py-2 transition ${tablePickerView === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              onClick={() => setTablePickerView("list")}
            >
              Lista
            </button>
            <button
              className={`rounded-xl px-3 py-2 transition ${tablePickerView === "plan" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              onClick={() => setTablePickerView("plan")}
            >
              Plano
            </button>
          </div>
          {tablePickerView === "list" ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {tables.map((table: any) => {
                const isSelected = table.id === selectedTableId;
                const draftCount = (draftsByTable[table.id] || []).length;
                const summary = getTableSummary(table);
                return (
                  <button key={table.id} className={`rounded-2xl border p-3 text-left transition ${isSelected ? "border-violet-400 bg-violet-50 shadow-sm" : "border-slate-200 bg-white hover:border-violet-200"}`} onClick={() => void selectTable(table)}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`size-2.5 rounded-full ${colorByStatus[table.status] || "bg-emerald-500"}`} />
                      <span className="text-[0.65rem] uppercase tracking-wide text-slate-400">{labelByStatus[table.status] || table.status}</span>
                    </div>
                    <div className="font-semibold text-slate-900">{table.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{table.capacity} personas</div>
                    {summary.receiptNumber && <div className="mt-1 truncate text-[0.65rem] text-slate-400">{summary.receiptNumber}</div>}
                    {summary.total > 0 && <div className="mt-1 text-xs font-semibold text-slate-900">${summary.total.toFixed(2)}</div>}
                    {draftCount > 0 && <div className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-700">{draftCount} nuevos</div>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-center gap-3 text-[0.7rem] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-500" /> Libre</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-rose-500" /> En servicio</span>
                <span className="ml-auto text-[0.65rem] text-slate-400">Pasa el cursor para ampliar</span>
              </div>
              <div className="relative min-h-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80" onMouseEnter={() => setPlanExpanded(true)}>
                {tables.map((table: any) => {
                  return renderPlanButton(table);
                })}
                {tables.length === 0 && <div className="flex min-h-[340px] items-center justify-center text-sm text-slate-400">No hay mesas en el plano.</div>}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[0.7rem] text-slate-500">
                {tables.map((table: any) => {
                  const summary = getTableSummary(table);
                  return (
                    <button key={`summary-${table.id}`} className={`rounded-xl border px-3 py-2 text-left transition ${table.id === selectedTableId ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-white hover:border-violet-200"}`} onClick={() => void selectTable(table)}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-900">{table.name}</span>
                        <span className={`size-2 rounded-full ${colorByStatus[table.status] || "bg-emerald-500"}`} />
                      </div>
                      <div className="mt-1 text-[0.65rem] text-slate-500">{summary.receiptNumber || (summary.hasOpenOrder ? "Cuenta abierta" : "Sin cuenta")}</div>
                      <div className="mt-1 font-semibold text-slate-900">${summary.total.toFixed(2)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {tables.length === 0 && <div className="py-8 text-center text-sm text-slate-400">No hay mesas en este salón.</div>}
        </aside>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{currentTable ? currentTable.name : "Selecciona una mesa"}</h3>
              <p className="text-sm text-slate-500">{currentTable ? `${labelByStatus[currentTable.status] || currentTable.status} · ${currentTable.capacity} personas` : "Elige una mesa para cargar productos."}</p>
            </div>
            {currentTable && (
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                {activeOrder ? `Orden abierta ${activeOrder.receiptNumber}` : currentDraftCount > 0 ? "Borrador local" : currentTable.openReceiptNumber ? `Orden abierta ${currentTable.openReceiptNumber}` : "Sin orden"}
              </div>
            )}
          </div>

          <div className="relative mb-4">
            <svg className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-9 pr-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15" placeholder="Buscar productos para la mesa..." value={productQuery} onInput={(e: any) => setProductQuery(e.target.value)} />
          </div>

          {!currentTable && <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">Selecciona una mesa para empezar a cargar la cuenta.</div>}

          {currentTable && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
              {filteredProducts.map((product: any) => (
                <button key={product.id} className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-violet-300 hover:shadow-sm disabled:opacity-40" onClick={() => addToDraft(product)} disabled={product.currentStock <= 0 || loadingTable}>
                  <div className="mb-2 truncate text-sm font-semibold text-slate-900">{product.name}</div>
                  <div className="text-lg font-bold text-violet-700">${product.price.toFixed(2)}</div>
                  <div className="mt-2 text-[0.7rem] text-slate-400">Stock {product.currentStock} {product.unit}</div>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">Cuenta</h3>
              <p className="text-xs text-slate-500">{currentTable ? `Mesa activa: ${currentTable.name}` : "Sin mesa seleccionada"}</p>
            </div>
            {currentTable && draftItems.length > 0 && <button className="text-xs font-medium text-red-500 hover:text-red-600" onClick={() => clearDraftForTable(currentTable.id)}>Descartar nuevos</button>}
          </div>

          <div className="space-y-2">
            {savedItems.map((item: any) => (
              <div key={`saved-${item.id}`} className="flex items-center gap-2 rounded-2xl border border-slate-100 px-3 py-2 text-sm">
                <div className="flex-1">
                  <div className="font-medium text-slate-900">{item.name || `Prod #${item.productId}`}</div>
                  <div className="text-[0.7rem] text-slate-400">Guardado en la orden</div>
                </div>
                <div className="text-xs text-slate-500">x{item.quantity}</div>
                <div className="font-semibold text-slate-900">${item.total.toFixed(2)}</div>
              </div>
            ))}
            {draftItems.map((item: any, index: number) => (
              <div key={`draft-${index}`} className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm">
                <div className="flex-1">
                  <div className="font-medium text-slate-900">{item.name}</div>
                  <div className="text-[0.7rem] text-amber-700">Nuevo en esta mesa</div>
                </div>
                <input className="w-14 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm outline-none focus:border-violet-500" type="number" min="0.5" step="0.5" value={item.quantity} onInput={(e: any) => updateDraftQty(index, parseFloat(e.target.value) || 0.5)} />
                <div className="font-semibold text-slate-900">${item.total.toFixed(2)}</div>
                <button className="text-red-500 hover:text-red-600" onClick={() => removeDraftItem(index)}>✕</button>
              </div>
            ))}
          </div>

          {allOrderItems.length === 0 && <div className="py-10 text-center text-sm text-slate-400">La mesa no tiene productos todavía.</div>}

          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Total</span>
              <span className="text-2xl font-bold text-slate-900">${orderTotal.toFixed(2)}</span>
            </div>

            <div className="space-y-2">
              <button className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" onClick={saveOrder} disabled={!currentTable || draftItems.length === 0 || submitting}>
                {submitting ? "Guardando..." : activeOrder ? "Agregar a la mesa" : "Enviar a la mesa"}
              </button>
              <button className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" onClick={openPayDialog} disabled={!activeOrder || draftItems.length > 0 || submitting}>
                {!activeOrder ? "No hay cuenta abierta" : draftItems.length > 0 ? "Guarda nuevos items antes de cobrar" : "Cobrar mesa"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
