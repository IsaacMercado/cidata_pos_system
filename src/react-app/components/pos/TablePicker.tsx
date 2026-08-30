import { useState } from "preact/hooks";
import { Map, List, Users, Utensils } from "lucide-react";
import { Button, Card } from "../../components/ui";

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

  function renderPlanButton(table: any) {
    const summary = getTableSummary(table);
    const selected = table.id === selectedTableId;
    const width = Math.max(table.width || 86, 86);
    const height = table.shape === "circle" ? width : Math.max(table.height || 72, 72);
    return (
      <button
        key={table.id}
        type="button"
        className={`absolute flex cursor-pointer flex-col items-center justify-center text-white shadow-md transition hover:scale-105 ${table.shape === "circle" ? "rounded-full" : "rounded-2xl"} ${colorByStatus[table.status] || "bg-emerald-500"} ${selected ? "ring-4 ring-violet-300 ring-offset-2" : ""}`}
        style={{ left: table.posX, top: table.posY, width, height }}
        onClick={() => onSelectTable(table)}
      >
        <span className="text-xs font-bold">{table.name}</span>
        <span className="text-[0.65rem] opacity-80">{table.capacity} pax</span>
        {summary.total > 0 && <span className="text-xs font-semibold">${summary.total.toFixed(2)}</span>}
      </button>
    );
  }

  return (
    <Card className="overflow-hidden rounded-3xl border-slate-200 bg-white shadow-sm lg:sticky lg:top-4">
      <div className="border-b border-slate-100 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-900">
              <Utensils size={17} className="text-violet-600" />
              <h3 className="font-bold">Mesas</h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">Selecciona dónde atender</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{tables.length}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          <Button variant={view === "list" ? "primary" : "ghost"} size="sm" className="rounded-lg text-xs" onClick={() => setView("list")}><List size={14} /> Lista</Button>
          <Button variant={view === "plan" ? "primary" : "ghost"} size="sm" className="rounded-lg text-xs" onClick={() => setView("plan")}><Map size={14} /> Plano</Button>
        </div>
      </div>

      {view === "list" ? (
        <div className="max-h-[calc(100vh-250px)] space-y-2 overflow-y-auto p-3">
          {tables.map((table: any) => {
            const summary = getTableSummary(table);
            const draftCount = (draftsByTable[table.id] || []).length;
            const selected = table.id === selectedTableId;
            return (
              <button type="button" key={table.id} onClick={() => onSelectTable(table)} className={`w-full rounded-2xl border p-3 text-left transition ${selected ? "border-violet-300 bg-violet-50 shadow-sm" : "border-slate-100 bg-white hover:border-violet-200 hover:bg-slate-50"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`size-2.5 shrink-0 rounded-full ${colorByStatus[table.status] || "bg-emerald-500"}`} />
                    <span className="truncate font-semibold text-slate-800">{table.name}</span>
                  </div>
                  <span className="text-[0.65rem] font-medium text-slate-400">{labelByStatus[table.status] || table.status}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Users size={12} /> {table.capacity} personas</span>
                  {summary.total > 0 && <strong className="text-slate-800">${summary.total.toFixed(2)}</strong>}
                </div>
                {draftCount > 0 && <div className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-700">{draftCount} nuevos</div>}
              </button>
            );
          })}
          {tables.length === 0 && <p className="px-2 py-8 text-center text-sm text-slate-400">No hay mesas configuradas.</p>}
        </div>
      ) : (
        <div className="p-3">
          <div className="mb-3 flex flex-wrap gap-3 text-[0.65rem] text-slate-500">
            <span><i className="mr-1 inline-block size-2 rounded-full bg-emerald-500" />Libre</span>
            <span><i className="mr-1 inline-block size-2 rounded-full bg-rose-500" />En servicio</span>
            <span><i className="mr-1 inline-block size-2 rounded-full bg-amber-500" />Reservada</span>
          </div>
          <div className="relative min-h-[360px] overflow-auto rounded-2xl border border-slate-100 bg-slate-50">
            {tables.map(renderPlanButton)}
            {tables.length === 0 && <p className="flex min-h-[360px] items-center justify-center text-sm text-slate-400">No hay mesas en el plano.</p>}
          </div>
        </div>
      )}
    </Card>
  );
}
