import { useState, useEffect, useRef } from "preact/hooks";
import { SubmitHandler, useForm } from "react-hook-form";
import { api } from "../lib/api";
import { useToast } from "../components/pos/Toast";
import { Users, UserPlus, Trash2 } from "lucide-react";
import { Button, Input, Loading, PageHeader, Table } from "../components/ui";

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

  if (loading) return <Loading text="Cargando..." />;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Clientes"
        icon={Users}
        action={
          <Button onClick={() => dialog.current?.showModal()}>
            <UserPlus size={14} /> Nuevo
          </Button>
        }
      />

      <Table>
        <Table.Head>
          <Table.Row>
            <Table.Header>Nombre</Table.Header>
            <Table.Header className="hidden sm:table-cell">Email</Table.Header>
            <Table.Header className="hidden sm:table-cell">Teléfono</Table.Header>
            <Table.Header className="hidden md:table-cell">Registro</Table.Header>
            <Table.Header>Acciones</Table.Header>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {customers.filter((c: any) => c.isActive !== 0).map((c: any) => (
            <Table.Row key={c.id}>
              <Table.Cell className="font-medium text-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-50 to-violet-100 flex items-center justify-center flex-shrink-0">
                    <Users size={14} className="text-violet-500" />
                  </span>
                  {c.name}
                </div>
              </Table.Cell>
              <Table.Cell className="text-zinc-500 text-sm hidden sm:table-cell">
                {c.email || <span className="text-zinc-300">—</span>}
              </Table.Cell>
              <Table.Cell className="text-zinc-500 text-sm hidden sm:table-cell">
                {c.phone || <span className="text-zinc-300">—</span>}
              </Table.Cell>
              <Table.Cell className="text-xs text-zinc-400 hidden md:table-cell">
                {new Date(c.createdAt).toLocaleDateString()}
              </Table.Cell>
              <Table.Cell>
                <button onClick={() => remove(c.id)} className="text-xs text-red-400 hover:text-red-600 transition-colors flex items-center gap-1">
                  <Trash2 size={12} />
                  Eliminar
                </button>
              </Table.Cell>
            </Table.Row>
          ))}
          {customers.length === 0 && <Table.Empty colSpan={5}>No hay clientes registrados</Table.Empty>}
        </Table.Body>
      </Table>

      <dialog
        ref={dialog}
        className="rounded-2xl shadow-2xl border border-zinc-200 p-0 backdrop:bg-black/30 w-[calc(100%-2rem)] max-w-md bg-white max-h-[90dvh] overflow-y-auto"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <h2 className="text-lg font-bold">Nuevo Cliente</h2>

          <Input label="Nombre" {...register("name", { required: true })} />

          <div className="flex gap-3">
            <Input label="Email" type="email" className="flex-1" {...register("email")} />
            <Input label="Teléfono" className="flex-1" {...register("phone")} />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={() => dialog.current?.close()}>Cancelar</Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
