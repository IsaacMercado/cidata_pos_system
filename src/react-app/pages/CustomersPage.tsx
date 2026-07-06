import { useState, useEffect, useRef } from "preact/hooks";
import { SubmitHandler, useForm } from "react-hook-form";
import { api } from "../lib/api";
import { useToast } from "../components/pos/Toast";
import { Users, UserPlus, Trash2 } from "lucide-react";

interface FormData {
  name: string;
  email: string;
  phone: string;
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const dialog = useRef<HTMLDialogElement>(null);
  const { toast } = useToast();
  const { register, handleSubmit, reset } = useForm<FormData>({
    defaultValues: { name: "", email: "", phone: "" },
  });

  async function load() {
    const data = await api.customers.list();
    setCustomers(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      await api.customers.create({
        code: `CLT-${Date.now()}`,
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
      });
      dialog.current?.close();
      reset();
      toast("Cliente creado", "success");
      await load();
    } catch {
      toast("Error al crear cliente", "error");
    }
  }

  async function remove(id: number) {
    try {
      await api.customers.update(id, { isActive: 0 });
      toast("Cliente eliminado", "success");
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
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-400 to-violet-500 flex items-center justify-center text-white">
            <Users size={14} />
          </span>
          Clientes
        </h1>
        <button
          onClick={() => dialog.current?.showModal()}
          className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-500 transition-colors flex items-center gap-1.5"
        >
          <UserPlus size={14} />
          Nuevo
        </button>
      </div>

      <div className="overflow-hidden border border-zinc-200 rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 text-left">
                <th className="px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Nombre</th>
                <th className="px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider hidden sm:table-cell">Email</th>
                <th className="px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider hidden sm:table-cell">Teléfono</th>
                <th className="px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider hidden md:table-cell">Registro</th>
                <th className="px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {customers.filter((c: any) => c.isActive !== 0).map((c: any) => (
                <tr key={c.id} className="border-t border-zinc-100 hover:bg-violet-50/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-zinc-800">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-50 to-violet-100 flex items-center justify-center flex-shrink-0">
                        <Users size={14} className="text-violet-500" />
                      </span>
                      {c.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-sm hidden sm:table-cell">
                    {c.email || <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-sm hidden sm:table-cell">
                    {c.phone || <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400 hidden md:table-cell">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => remove(c.id)} className="text-xs text-red-400 hover:text-red-600 transition-colors flex items-center gap-1">
                      <Trash2 size={12} />
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-zinc-400">No hay clientes registrados</td>
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
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <h2 className="text-lg font-bold">Nuevo Cliente</h2>

          <label className="block">
            <span className="text-sm text-zinc-500">Nombre</span>
            <input
              {...register("name", { required: true })}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-zinc-300 rounded outline-none focus:border-zinc-500"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex-1">
              <span className="text-sm text-zinc-500">Email</span>
              <input type="email"
                {...register("email")}
                className="mt-1 w-full px-3 py-1.5 text-sm border border-zinc-300 rounded outline-none focus:border-zinc-500"
              />
            </label>
            <label className="flex-1">
              <span className="text-sm text-zinc-500">Teléfono</span>
              <input
                {...register("phone")}
                className="mt-1 w-full px-3 py-1.5 text-sm border border-zinc-300 rounded outline-none focus:border-zinc-500"
              />
            </label>
          </div>

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
