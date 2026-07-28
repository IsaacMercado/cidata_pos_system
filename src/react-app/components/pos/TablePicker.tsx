import { useState } from "preact/hooks";
import { Button, Card } from "../../components/ui";
import { GripVertical } from "lucide-react";

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

interface TablePickerProps {
  tables: any[];
  selectedTableId: number | null;
  draftsByTable: Record<number, any[]>;
  onSelectTable: (table: any) => void;
  getTableSummary: (table: any) => { total: number; itemsCount: number; hasOpenOrder: boolean; receiptNumber: string | null };
}

export function TablePicker({ tables, selectedTableId, draftsByTable, onSelectTable, getTableSummary }: TablePickerProps) {
  const [view, setView] = useState<"list" | "plan">("list");
  const [planExpanded, setPlanExpanded] = useState(false);

function renderPlanButton(table: any, expanded = false) {
    const isSelected = table.id === selectedTableId;
    const summary = getTableSummary(table);
    const width = expanded ? Math.max(table.width + 18, 86) : table.width;
    const height = table.shape === "circle" ? width : (expanded ? Math.max(table.height + 12, 72) : table.height);

    return (
      <button
        key={table.id}
        className={`absolute flex cursor-grab flex-col items-center justify-center text-white shadow-lg transition ${table.shape === "circle" ? "rounded-full" : "rounded-2xl"} ${colorByStatus[table.status] || "bg-emerald-500"} ${isSelected ? "ring-4 ring-violet-200" : "hover:ring-2 hover:ring-violet-300"}`}
        style={{ left: table.posX, top: table.posY, width, height }}
        onClick={() => onSelectTable(table)}
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

  return (
    <Card className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-[0_20px_45px_rgba(15,23,42,0.08)]" style={{ alignSelf: "start" }}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Mesas</h3>
          <p className="text-xs text-slate-500">Cambia entre lista y plano para elegir la mesa.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">{tables.length}</span>
      </div>

      <div className="mb-3 grid grid-cols-2 rounded-2xl bg-slate-100 p-1 text-xs font-medium">
        <Button
          variant={view === "list" ? "default" : "ghost"}
          size="sm"
          className="rounded-xl px-3 py-2 transition"
          onClick={() => setView("list")}
        >
          Lista
        </Button>
        <Button
          variant={view === "plan" ? "default" : "ghost"}
          size="sm"
          className="rounded-xl px-3 py-2 transition"
          onClick={() => setView("plan")}
        >
          Plano
        </Button>
      </div>

      {view === "list" ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {tables.map((table: any) => {
            const isSelected = table.id === selectedTableId;
            const draftCount = (draftsByTable[table.id] || []).length;
            const summary = getTableSummary(table);
            return (
              <Button
                key={table.id}
                variant="ghost"
                className={`rounded-2xl border p-3 text-left transition ${isSelected ? "border-violet-400 bg-violet-50 shadow-sm" : "border-slate-200 bg-white hover:border-violet-200"}`}
                onClick={() => onSelectTable(table)}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className={`size-2.5 rounded-full ${colorByStatus[table.status] || "bg-emerald-500"}`} />
                  <span className="text-[0.65rem] uppercase tracking-wide text-slate-400">{labelByStatus[table.status] || table.status}</span>
                </div>
                <div className="font-semibold">{table.name}</div>
                <div className="mt-1 text-xs text-slate-500">{table.capacity} personas</div>
                {summary.receiptNumber && <div className="mt-1 truncate text-[0.65rem] text-slate-400">{summary.receiptNumber}</div>}
                {summary.total > 0 && <div className="mt-1 text-xs font-semibold">${summary.total.toFixed(2)}</div>}
                {draftCount > 0 && <div className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-700">{draftCount} nuevos</div>}
              </Button>
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
          <div
            className="relative min-h-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80"
            onMouseEnter={() => setPlanExpanded(true)}
            onMouseLeave={() => setPlanExpanded(false)}
          >
            {tables.map((table: any) => renderPlanButton(table))}
            {tables.length === 0 && <div className="flex min-h-[340px] items-center justify-center text-sm text-slate-400">No hay mesas en el plano.</div>}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[0.7rem] text-slate-500">
            {tables.map((table: any) => {
              const summary = getTableSummary(table);
              return (
                <Button
                  key={`summary-${table.id}`}
                  variant="ghost"
                  className={`rounded-xl border px-3 py-2 text-left transition ${table.id === selectedTableId ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-white hover:border-violet-200"}`}
                  onClick={() => onSelectTable(table)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{table.name}</span>
                    <span className={`size-2 rounded-full ${colorByStatus[table.status] || "bg-emerald-500"}`} />
                  </div>
                  <div className="mt-1 text-[0.65rem] text-slate-500">{summary.receiptNumber || (summary.hasOpenOrder ? "Cuenta abierta" : "Sin cuenta")}</div>
                  <div className="mt-1 font-semibold">${summary.total.toFixed(2)}</div>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {tables.length === 0 && <div className="py-8 text-center text-sm text-slate-400">No hay mesas en este salón.</div>}
    </Card>
  );
}