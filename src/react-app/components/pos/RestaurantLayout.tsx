import { useEffect, useRef, useState } from "preact/hooks";
import { useToast } from "../../components/pos/Toast";
import { Button, Card, CardHeader, CardTitle, CardContent, CardFooter, Input, Dialog } from "../../components/ui";
import { api } from "../../lib/api";
import { paymentMethods } from "../../lib/paymentMethods";
import { useOnlineStatus } from "../../lib/useOnlineStatus";
import { Plus, Trash2, GripVertical } from "lucide-react";

type TableShape = "circle" | "rectangle";
type TableForm = { name: string; capacity: number; shape: TableShape };

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

interface RestaurantLayoutProps {
  restaurant: any;
  onClose: () => void;
  onAddTable: () => void;
  onRemoveTable: (tableId: number) => void;
  onUpdateTablePosition: (tableId: number, posX: number, posY: number) => void;
}

export function RestaurantLayout({ restaurant, onClose, onAddTable, onRemoveTable, onUpdateTablePosition }: RestaurantLayoutProps) {
  const [showTableForm, setShowTableForm] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const dragRef = useRef({ startX: 0, startY: 0, tableId: 0 });
  const tables = restaurant?.tables || [];

  const tableForm = {
    defaultValues: { name: `Mesa ${tables.length + 1}`, capacity: 2, shape: "circle" as TableShape },
  };

  async function handleSaveTable(data: TableForm) {
    if (!restaurant) return;
    await api.restaurants.addTable(restaurant.id, data);
    setShowTableForm(false);
    window.location.reload();
  }

  function onDragStart(e: React.MouseEvent<HTMLDivElement>, table: any) {
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

  function renderPlanButton(table: any, expanded = false) {
    const width = expanded ? Math.max(table.width + 18, 86) : table.width;
    const height = table.shape === "circle" ? width : (expanded ? Math.max(table.height + 12, 72) : table.height);

    return (
      <button
        key={table.id}
        className={`absolute flex cursor-grab flex-col items-center justify-center text-white shadow-lg transition ${table.shape === "circle" ? "rounded-full" : "rounded-2xl"} ${colorByStatus[table.status] || "bg-emerald-500"} ${dragging === table.id ? "scale-105 opacity-80" : "hover:ring-2 hover:ring-violet-400"}`}
        style={{ left: table.posX, top: table.posY, width, height }}
        onMouseDown={(e) => onDragStart(e, table)}
      >
        <div className="pointer-events-none text-center leading-tight">
          <div className={`${expanded ? "text-xs" : "text-[0.7rem]"} font-bold`}>{table.name}</div>
          <div className={`${expanded ? "text-[0.7rem]" : "text-[0.6rem]"} opacity-80`}>{table.capacity} pax</div>
          {table.openTotal && <div className={`${expanded ? "text-[0.7rem]" : "text-[0.55rem]"} font-semibold opacity-95`}>${Number(table.openTotal).toFixed(2)}</div>}
        </div>
      </button>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button className="mb-2 text-sm font-medium text-violet-700" onClick={onClose}>Mesas</button>
          <h2 className="text-xl font-bold">{restaurant.name}</h2>
          <p className="text-sm text-slate-500">Editor de plano del salón.</p>
        </div>
        <div className="flex gap-2">
          <a href={`/restaurants/${restaurant.id}/order`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">Servicio</a>
          <Button variant="accent" size="sm" onClick={onAddTable}>Nueva mesa</Button>
        </div>
      </div>

      {showTableForm && (
        <form className="mb-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-cyan-50 p-4" onSubmit={(e) => { e.preventDefault(); const formData = new FormData(e.currentTarget); handleSaveTable({ name: formData.get("name") as string, capacity: parseInt(formData.get("capacity") as string), shape: formData.get("shape") as TableShape }); }}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Nombre" name="name" required />
            <Input label="Capacidad" name="capacity" type="number" min="1" required />
          </div>
          <div className="mt-3 flex gap-2">
            {(["circle", "rectangle"] as const).map((shape) => (
              <label key={shape} className={`rounded-xl border px-3 py-2 text-sm cursor-pointer ${tableForm.defaultValues.shape === shape ? "border-violet-500 bg-white text-violet-700" : "border-slate-200 bg-white text-slate-600"}`}>
                <input className="sr-only" type="radio" name="shape" value={shape} defaultChecked={tableForm.defaultValues.shape === shape} />
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
          {tables.map((table: any) => renderPlanButton(table))}
          {tables.length === 0 && <div className="flex h-[380px] items-center justify-center text-sm text-slate-400">Crea la primera mesa para este salón.</div>}
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