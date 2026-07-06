import { Coffee, Milk, Package, Plus, Popcorn, Sandwich, Sparkles, Trash2, Pencil } from "lucide-react";
import { useEffect, useState } from "preact/hooks";
import { SubmitHandler, useForm } from "react-hook-form";
import { useToast } from "../components/pos/Toast";
import { api } from "../lib/api";
import { Badge, Button, Input, Loading, Modal, PageHeader, Select, Table } from "../components/ui";

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

interface FormData {
  code: string;
  name: string;
  price: number;
  cost: number;
  categoryId: number | undefined;
  description: string | undefined;
  currentStock: number;
}

export function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const { toast } = useToast();

  const { register, handleSubmit, reset } = useForm<FormData>({
    defaultValues: {
      code: "",
      name: "",
      price: 0,
      cost: 0,
      categoryId: undefined,
      description: undefined,
      currentStock: 0,
    },
  });

  async function load() {
    const data = await api.products.list();
    setProducts(data || []);
    setCategories([]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditingProduct(null);
    reset({ code: "", name: "", price: 0, cost: 0, categoryId: undefined, description: undefined, currentStock: 0 });
    setModalOpen(true);
  }

  function openEdit(product: any) {
    setEditingProduct(product);
    reset({
      code: product.code || "",
      name: product.name || "",
      price: product.price || 0,
      cost: product.cost || 0,
      categoryId: product.categoryId || undefined,
      description: product.description || undefined,
      currentStock: product.currentStock || 0,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingProduct(null);
  }

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      if (editingProduct) {
        await api.products.update(editingProduct.id, {
          code: data.code,
          name: data.name,
          price: data.price,
          cost: data.cost || 0,
          categoryId: data.categoryId || undefined,
          description: data.description || undefined,
          currentStock: data.currentStock || 0,
        });
        toast("Producto actualizado", "success");
      } else {
        await api.products.create({
          code: data.code || `PROD-${Date.now()}`,
          name: data.name,
          price: data.price,
          cost: data.cost || 0,
          categoryId: data.categoryId || undefined,
          description: data.description || undefined,
          currentStock: data.currentStock || 0,
        });
        toast("Producto creado", "success");
      }
      closeModal();
      await load();
    } catch {
      toast(editingProduct ? "Error al actualizar" : "Error al crear producto", "error");
    }
  };

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

  if (loading) return <Loading text="Cargando..." />;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Productos"
        icon={Package}
        action={
          <Button onClick={openNew}>
            <Plus size={14} /> Nuevo
          </Button>
        }
      />

      <Table>
        <Table.Head>
          <Table.Row>
            <Table.Header>Nombre</Table.Header>
            <Table.Header className="hidden sm:table-cell">SKU</Table.Header>
            <Table.Header className="hidden md:table-cell">Categoría</Table.Header>
            <Table.Header className="text-right">Precio</Table.Header>
            <Table.Header className="text-right">Stock</Table.Header>
            <Table.Header>Estado</Table.Header>
            <Table.Header>Acciones</Table.Header>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {products.map((p: any) => (
            <Table.Row key={p.id}>
              <Table.Cell className="font-medium text-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center flex-shrink-0">
                    {p.category ? <CategoryIcon name={p.category.name} /> : <Package size={14} className="text-indigo-500" />}
                  </span>
                  {p.name}
                </div>
              </Table.Cell>
              <Table.Cell className="text-zinc-400 text-xs hidden sm:table-cell">{p.code || "—"}</Table.Cell>
              <Table.Cell className="text-zinc-500 hidden md:table-cell">
                {p.category?.name && <Badge>{p.category.name}</Badge>}
              </Table.Cell>
              <Table.Cell className="text-right font-semibold text-zinc-800">${p.price.toFixed(2)}</Table.Cell>
              <Table.Cell className="text-right">
                <span className={`font-medium text-sm ${p.currentStock <= 5 ? "text-amber-600" : p.currentStock === 0 ? "text-red-500" : "text-zinc-800"}`}>
                  {p.currentStock}
                </span>
              </Table.Cell>
              <Table.Cell>
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
              </Table.Cell>
              <Table.Cell>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(p)} className="text-xs text-indigo-400 hover:text-indigo-600 transition-colors flex items-center gap-1">
                    <Pencil size={12} />
                    Editar
                  </button>
                  <button onClick={() => remove(p.id)} className="text-xs text-red-400 hover:text-red-600 transition-colors flex items-center gap-1">
                    <Trash2 size={12} />
                    Eliminar
                  </button>
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
          {products.length === 0 && <Table.Empty colSpan={7}>No hay productos</Table.Empty>}
        </Table.Body>
      </Table>

      <Modal open={modalOpen} onClose={closeModal} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <h2 className="text-lg font-bold">{editingProduct ? "Editar Producto" : "Nuevo Producto"}</h2>

          <Input label="Nombre" {...register("name", { required: true })} />

          <div className="flex gap-3">
            <Input label="Precio" type="number" step="0.01" className="flex-1" {...register("price", { required: true })} />
            <Input label="Costo" type="number" step="0.01" className="flex-1" {...register("cost")} />
          </div>

          <div className="flex gap-3">
            <Input label="Código" className="flex-1" {...register("code")} />
            <Input label="Stock" type="number" className="flex-1" {...register("currentStock")} />
          </div>

          <Select label="Categoría" {...register("categoryId")}>
            <option value="">Sin categoría</option>
            {categories.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>

          <label className="block">
            <span className="text-sm text-zinc-500">Descripción</span>
            <textarea
              {...register("description")}
              rows={2}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-zinc-300 rounded outline-none focus:border-zinc-500"
            />
          </label>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={closeModal}>Cancelar</Button>
            <Button type="submit">{editingProduct ? "Guardar cambios" : "Guardar"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
