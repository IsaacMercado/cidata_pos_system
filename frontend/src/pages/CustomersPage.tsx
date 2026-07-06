import { useState, useEffect } from "preact/hooks";
import { api } from "../lib/api";
import { cacheCustomers, getCachedCustomers } from "../lib/db";
import { useOnlineStatus } from "../lib/useOnlineStatus";

export function CustomersPage() {
  const [list, setList] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", phone: "", email: "" });
  const online = useOnlineStatus();

  useEffect(() => { load(); }, []);

  async function load() {
    if (online) {
      try { const data = await api.customers.list({}); await cacheCustomers(data); setList(data); return; } catch {}
    }
    setList(await getCachedCustomers());
  }

  const filtered = search
    ? list.filter((c: any) => c.name?.toLowerCase().includes(search.toLowerCase()) || c.code?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))
    : list;

  async function save(e: Event) {
    e.preventDefault();
    if (online) await api.customers.create(form);
    setShowForm(false); setForm({ code: "", name: "", phone: "", email: "" });
    await load();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Clientes</h2>
        <button
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            showForm ? "bg-slate-200 text-slate-600" : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Cancelar" : "+ Nuevo"}
        </button>
      </div>

      {showForm && (
        <form className="mb-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" onSubmit={save}>
          <div className="grid grid-cols-2 gap-2">
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" placeholder="Código" value={form.code} onInput={(e: any) => setForm({ ...form, code: e.target.value })} required />
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" placeholder="Nombre" value={form.name} onInput={(e: any) => setForm({ ...form, name: e.target.value })} required />
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" placeholder="Teléfono" value={form.phone} onInput={(e: any) => setForm({ ...form, phone: e.target.value })} />
            <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" type="email" placeholder="Email" value={form.email} onInput={(e: any) => setForm({ ...form, email: e.target.value })} />
          </div>
          <button className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">Crear Cliente</button>
        </form>
      )}

      <input
        className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
        placeholder="Buscar clientes..."
        value={search}
        onInput={(e: any) => setSearch(e.target.value)}
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
              {["Código", "Nombre", "Teléfono", "Email"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c: any) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2 text-slate-500">{c.code}</td>
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2 text-slate-600">{c.phone || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{c.email || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="py-10 text-center text-sm text-slate-400">No hay clientes</div>}
      </div>
    </div>
  );
}
