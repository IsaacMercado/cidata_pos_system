import { useState, useEffect, useRef } from "preact/hooks";
import { api } from "../lib/api";
import { useToast } from "../components/pos/Toast";
import { Package, Coffee, Sandwich, Popcorn, Milk, Sparkles, Plus, Trash2 } from "lucide-react";

const CATEGORY_ICONS: Record<string, typeof Coffee> = {
  Bebidas: Coffee,
  Alimentos: Sandwich,
  Snacks: Popcorn,
  Lácteos: Milk,
  Limpieza: Sparkles,
};

function CategoryIcon({ name }: { name: string }) {
  const Icon = CATEGORY_ICONS[name];
  if (!Icon) return <Package size={14} />;
  return <Icon size={14} />;
}

export function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const dialog = useRef<HTMLDialogElement>(null);
  const { toast } = useToast();

  async function load() {
    const data = await api.products.list();
    setProducts(data || []);
    setCategories([]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save(e: Event) {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      await api.products.create({
        code: (fd.get("code") as string) || `PROD-${Date.now()}`,
        name: fd.get("name") as string,
        price: parseFloat(fd.get("price") as string),
        cost: parseFloat((fd.get("cost") as string) || "0"),
        categoryId: parseInt(fd.get("category_id") as string) || undefined,
        description: (fd.get("description") as string) || undefined,
        currentStock: parseInt((fd.get("stock") as string) || "0"),
      });
      dialog.current?.close();
      toast("Producto creado", "success");
      await load();
    } catch {
      toast("Error al crear producto", "error");
    }
  }

  async function toggleActive(product: any) {
    try {
      await api.products.update(product.id, { isActive: product.isActive ? 0 : 1 });
      toast(product.isActive ? "Producto desactivado" : "Producto activado", "success");
      await load();
    } catch {
      toast("Error al actualizar", "error");
    }
  }

  async function remove(id: number) {
    try {
      await api.products.deactivate(id);
      toast("Producto eliminado", "success");
      await load();
    } catch {
      toast("Error al eliminar", "error");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 py-12">
        <div className="animate-pulse text-sm">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-zinc-800 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-500 flex items-center justify-center text-white">
            <Package size={14} />
          </span>
          Productos
        </h1>
        <button
          onClick={() => dialog.current?.showModal()}
          className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-500 transition-colors flex items-center gap-1.5"
        >
          <Plus size={14} />
          Nuevo
        </button>
      </div>

      <div className="overflow-hidden border border-zinc-200 rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 text-left">
                <th className="px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Nombre</th>
                <th className="px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider hidden sm:table-cell">SKU</th>
                <th className="px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider hidden md:table-cell">Categoría</th>
                <th className="px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider text-right">Precio</th>
                <th className="px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider text-right">Stock</th>
                <th className="px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p: any) => (
                <tr key={p.id} className="border-t border-zinc-100 hover:bg-indigo-50/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-zinc-800">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center flex-shrink-0">
                        {p.category ? <CategoryIcon name={p.category.name} /> : <Package size={14} className="text-indigo-500" />}
                      </span>
                      {p.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs hidden sm:table-cell">{p.code || "—"}</td>
                  <td className="px-4 py-3 text-zinc-500 hidden md:table-cell">
                    {p.category?.name && (
                      <span className="bg-zinc-100 text-zinc-600 text-[10px] px-2 py-0.5 rounded-full">{p.category.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-zinc-800">${p.price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium text-sm ${p.currentStock <= 5 ? "text-amber-600" : p.currentStock === 0 ? "text-red-500" : "text-zinc-800"}`}>
                      {p.currentStock}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(p)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                        p.isActive
                          ? "text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                          : "text-zinc-400 border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
                      }`}
                    >
                      {p.isActive ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => remove(p.id)} className="text-xs text-red-400 hover:text-red-600 transition-colors flex items-center gap-1">
                      <Trash2 size={12} />
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-400">No hay productos</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <dialog
        ref={dialog}
        className="rounded-2xl shadow-2xl border border-zinc-200 p-0 backdrop:bg-black/30 w-[calc(100%-2rem)] max-w-md bg-white max-h-[90dvh] overflow-y-auto"
      >
        <form onSubmit={save} className="p-5 space-y-4">
          <h2 className="text-lg font-bold">Nuevo Producto</h2>

          <label className="block">
            <span className="text-sm text-zinc-500">Nombre</span>
            <input name="name" required
              className="mt-1 w-full px-3 py-1.5 text-sm border border-zinc-300 rounded outline-none focus:border-zinc-500"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex-1">
              <span className="text-sm text-zinc-500">Precio</span>
              <input name="price" type="number" step="0.01" required
                className="mt-1 w-full px-3 py-1.5 text-sm border border-zinc-300 rounded outline-none focus:border-zinc-500"
              />
            </label>
            <label className="flex-1">
              <span className="text-sm text-zinc-500">Costo</span>
              <input name="cost" type="number" step="0.01"
                className="mt-1 w-full px-3 py-1.5 text-sm border border-zinc-300 rounded outline-none focus:border-zinc-500"
              />
            </label>
          </div>

          <div className="flex gap-3">
            <label className="flex-1">
              <span className="text-sm text-zinc-500">Código</span>
              <input name="code"
                className="mt-1 w-full px-3 py-1.5 text-sm border border-zinc-300 rounded outline-none focus:border-zinc-500"
              />
            </label>
            <label className="flex-1">
              <span className="text-sm text-zinc-500">Stock</span>
              <input name="stock" type="number"
                className="mt-1 w-full px-3 py-1.5 text-sm border border-zinc-300 rounded outline-none focus:border-zinc-500"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm text-zinc-500">Categoría</span>
            <select name="category_id"
              className="mt-1 w-full px-3 py-1.5 text-sm border border-zinc-300 rounded outline-none focus:border-zinc-500"
            >
              <option value="">Sin categoría</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-zinc-500">Descripción</span>
            <textarea name="description" rows={2}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-zinc-300 rounded outline-none focus:border-zinc-500"
            />
          </label>

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={() => dialog.current?.close()}
              className="px-4 py-1.5 text-sm text-zinc-600 hover:text-zinc-900"
            >
              Cancelar
            </button>
            <button className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-500">
              Guardar
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
