import { Trash2, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "preact/hooks";
import { SubmitHandler, useForm } from "react-hook-form";
import { useToast } from "../components/pos/Toast";
import { Badge, Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Dialog, Input, Loading, PageHeader, Table } from "../components/ui";
import { api } from "../lib/api";

interface FormData {
  name: string;
  email: string;
  phone: string;
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
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

  function openModal() {
    reset({ name: "", email: "", phone: "" });
    setModalOpen(true);
  }

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      await api.customers.create({
        code: `CLT-${Date.now()}`,
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
      });
      setModalOpen(false);
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
          <Button onClick={openModal}>
            <UserPlus size={14} /> Nuevo
          </Button>
        }
      />

      <Card>
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
                    <span className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                      <Users size={14} className="text-violet-500" />
                    </span>
                    {c.name}
                  </div>
                </Table.Cell>
                <Table.Cell className="text-zinc-500 text-sm hidden sm:table-cell">
                  {c.email || <Badge variant="secondary" size="sm">—</Badge>}
                </Table.Cell>
                <Table.Cell className="text-zinc-500 text-sm hidden sm:table-cell">
                  {c.phone || <Badge variant="secondary" size="sm">—</Badge>}
                </Table.Cell>
                <Table.Cell className="text-xs text-zinc-400 hidden md:table-cell">
                  {(() => { const d = new Date(c.createdAt.replace(" ", "T") + "Z"); return Number.isNaN(d.getTime()) ? c.createdAt : d.toLocaleDateString(); })()}
                </Table.Cell>
                <Table.Cell>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => remove(c.id)}>
                    <Trash2 size={12} /> Eliminar
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
            {customers.length === 0 && <Table.Empty colSpan={5}>No hay clientes registrados</Table.Empty>}
          </Table.Body>
        </Table>
      </Card>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <CardHeader>
            <CardTitle>Nuevo Cliente</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setModalOpen(false)} aria-label="Cerrar">✕</Button>
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            <Input label="Nombre" {...register("name", { required: true })} />

            <div className="flex gap-3">
              <Input label="Email" type="email" className="flex-1" {...register("email")} />
              <Input label="Teléfono" className="flex-1" {...register("phone")} />
            </div>
          </CardContent>

          <CardFooter className="justify-end">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit">Guardar</Button>
          </CardFooter>
        </form>
      </Dialog>
    </div>
  );
}
