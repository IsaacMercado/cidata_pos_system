import type { TargetedMouseEvent } from "preact";
import { useRef, useState } from "preact/hooks";
import { useLocation } from "wouter-preact";
import { Button, Card } from "../../components/ui";
import { api } from "../../lib/api";

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

interface TableMapProps {
  restaurant: any;
  onClose: () => void;
  onAddTable: () => void;
  onRemoveTable: (tableId: number) => void;
  onUpdateTablePosition: (tableId: number, posX: number, posY: number) => void;
  onSelectTable: (table: any) => void;
  selectedTableId: number | null;
  draftsByTable: Record<number, any[]>;
  expanded: boolean;
  setExpanded: (value: boolean) => void;
}

export function TableMap({ restaurant, onClose, onAddTable, onRemoveTable, onUpdateTablePosition, onSelectTable, selectedTableId, draftsByTable, expanded, setExpanded }: TableMapProps) {
  const [dragging, setDragging] = useState<number | null>(null);
  const dragRef = useRef({ startX: 0, startY: 0, tableId: 0 });
  const tables = restaurant?.tables || [];
  const [, navigate] = useLocation();

  function getTableSummary(table: any) {
    const draftItemsForTable = draftsByTable[table.id] || [];
    const draftTotal = draftItemsForTable.reduce((sum, item) => sum + item.total, 0);
    const isActive = selectedTableId === table.id;
    const activeTotal = isActive ? draftTotal : 0;
    const backendOpenTotal = table.openTotal || 0;
    const total = activeTotal > 0 ? activeTotal : backendOpenTotal > 0 ? backendOpenTotal : draftTotal;
    const itemsCount = draftItemsForTable.length;
    return { total, itemsCount, hasOpenOrder: Boolean(table.openSaleId), receiptNumber: table.openReceiptNumber as string | null };
  }

  function renderPlanButton(table: any, isExpanded = false) {
    const isSelected = table.id === selectedTableId;
    const summary = getTableSummary(table);
    const width = isExpanded ? Math.max(table.width + 18, 86) : table.width;
    const height = table.shape === "circle" ? width : (isExpanded ? Math.max(table.height + 12, 72) : table.height);

    return (
      <button
        key={table.id}
        className={`absolute flex cursor-grab flex-col items-center justify-center text-white shadow-lg transition ${table.shape === "circle" ? "rounded-full" : "rounded-2xl"} ${colorByStatus[table.status] || "bg-emerald-500"} ${isSelected ? "ring-4 ring-violet-200" : "hover:ring-2 hover:ring-violet-300"} ${dragging === table.id ? "scale-105 opacity-80" : ""}`}
        style={{ left: table.posX, top: table.posY, width, height }}
        onClick={() => onSelectTable(table)}
        onMouseDown={(e) => onDragStart(e, table)}
      >
        <div className="pointer-events-none text-center leading-tight">
          <div className="text-xs font-bold">{table.name}</div>
          <div className="text-xs opacity-80">{table.capacity} pax</div>
          {summary.total > 0 && <div className="text-xs font-semibold opacity-95">${summary.total.toFixed(2)}</div>}
          {summary.itemsCount > 0 && <div className="text-xs opacity-90">+{summary.itemsCount} nuevos</div>}
        </div>
      </button>
    );
  }

  function onDragStart(e: TargetedMouseEvent<HTMLButtonElement>, table: any) {
    e.preventDefault();
    dragRef.current = { startX: e.clientX - table.posX, startY: e.clientY - table.posY, tableId: table.id };
    setDragging(table.id);

    const onMove = (ev: MouseEvent) => {
      if (!restaurant) return;
      const posX = Math.max(0, ev.clientX - dragRef.current.startX);
      const posY = Math.max(0, ev.clientY - dragRef.current.startY);
      onUpdateTablePosition(dragRef.current.tableId, posX, posY);
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

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ChevronLeftIcon /> Mesas
          </Button>
          <h2 className="text-xl font-bold">{restaurant.name}</h2>
          <p className="text-sm text-slate-500">Editor de plano del salón.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/restaurants")}>Servicio</Button>
          <Button variant="accent" size="sm" onClick={onAddTable}>Nueva mesa</Button>
        </div>
      </div>

      <Card className="mb-4">
        <div className="flex items-center gap-4 border-b border-slate-100 px-4 py-3 text-xs text-slate-500">
          <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-emerald-500" /> Libre</span>
          <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-rose-500" /> En servicio</span>
          <span className="ml-auto">Arrastra para reorganizar mesas</span>
        </div>
        <div
          className="relative min-h-[420px] overflow-auto p-4"
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
        >
          {tables.map((table: any) => renderPlanButton(table, expanded))}
          {tables.length === 0 && <div className="flex h-[380px] items-center justify-center text-sm text-slate-400">Pulsa "Nueva mesa" para crear la primera.</div>}
        </div>
      </Card>

      <Card>
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Mesas del salón</div>
        {tables.map((table: any) => (
          <div key={table.id} className="flex items-center gap-3 border-b border-slate-50 px-4 py-3 last:border-b-0">
            <span className={`size-2.5 rounded-full ${colorByStatus[table.status] || "bg-emerald-500"}`} />
            <div className="flex-1">
              <div className="font-medium">{table.name}</div>
              <div className="text-xs text-slate-500">{labelByStatus[table.status] || table.status} · {table.capacity} personas</div>
            </div>
            <Button variant="danger" size="sm" onClick={() => onRemoveTable(table.id)}>Eliminar</Button>
          </div>
        ))}
      </Card>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="w-3.5 h-3.5 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}
