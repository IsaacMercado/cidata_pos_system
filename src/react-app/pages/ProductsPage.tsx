import { useState, useEffect } from "preact/hooks";
import { api } from "../lib/api";
import { cacheProducts, getCachedProducts, addPendingOp } from "../lib/db";
import { useOnlineStatus } from "../lib/useOnlineStatus";

export function ProductsPage() {
  const [list, setList] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", price: 0, cost: 0, minStock: 0 });
  const [editing, setEditing] = useState<number | null>(null);
  const online = useOnlineStatus();

  useEffect(() => { load(); }, []);

  async function load() {
    if (online) {
      try { const data = await api.products.list({}); await cacheProducts(data); setList(data); return; } catch {}
    }
    setList(await getCachedProducts());
  }

  const filtered = search
    ? list.filter((p: any) => p.name?.toLowerCase().includes(search.toLowerCase()) || p.code?.toLowerCase().includes(search.toLowerCase()))
    : list;

  async function save(e: Event) {
    e.preventDefault();
    if (editing) {
      if (online) await api.products.update(editing, form);
      else await addPendingOp({ type: "update_product", payload: { id: editing, data: form } });
    } else {
      if (online) await api.products.create(form);
    }
    setShowForm(false); setEditing(null); setForm({ code: "", name: "", price: 0, cost: 0, minStock: 0 });
    await load();
  }

  function edit(p: any) {
    setForm({ code: p.code, name: p.name, price: p.price, cost: p.cost, minStock: p.minStock });
    setEditing(p.id); setShowForm(true);
  }

  async function remove(id: number) {
    if (!confirm("¿Desactivar este producto?")) return;
    if (online) await api.products.deactivate(id);
    await load();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Productos</h2>
        <button
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            showForm ? "bg-slate-200 text-slate-600" : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
          onClick={() => { setShowForm(!showForm); setEditing(null); setForm({ code: "", name: "", price: 0, cost: 0, minStock: 0 }); }}
        >
          {showForm ? "Cancelar" : "+ Nuevo"}
        </button>
      </div>

      {showForm && (
        <form className="mb-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" onSubmit={save}>
          <div className="grid grid-cols-2 gap-2">
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" placeholder="Código" value={form.code} onInput={(e: any) => setForm({ ...form, code: e.target.value })} required />
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" placeholder="Nombre" value={form.name} onInput={(e: any) => setForm({ ...form, name: e.target.value })} required />
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" type="number" step="0.01" placeholder="Precio" value={form.price || ""} onInput={(e: any) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} required />
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" type="number" step="0.01" placeholder="Costo" value={form.cost || ""} onInput={(e: any) => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })} />
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" type="number" placeholder="Stock mínimo" value={form.minStock || ""} onInput={(e: any) => setForm({ ...form, minStock: parseFloat(e.target.value) || 0 })} />
          </div>
          <button className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">{editing ? "Actualizar" : "Crear"} Producto</button>
        </form>
      )}

      <input
        className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
        placeholder="Buscar productos..."
        value={search}
        onInput={(e: any) => setSearch(e.target.value)}
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
              {["Código", "Nombre", "Precio", "Stock", "Acción"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p: any) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2 text-slate-500">{p.code}</td>
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2 font-semibold">${p.price.toFixed(2)}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                    p.currentStock <= p.minStock ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {p.currentStock} {p.unit}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <button className="mr-1 rounded px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50" onClick={() => edit(p)}>Editar</button>
                  <button className="rounded px-2 py-0.5 text-xs font-medium text-red-500 hover:bg-red-50" onClick={() => remove(p.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="py-10 text-center text-sm text-slate-400">No hay productos</div>}
      </div>
    </div>
  );
}
