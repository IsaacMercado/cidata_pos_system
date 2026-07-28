import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Coffee,
  Milk,
  Package,
  Pencil,
  Plus,
  Popcorn,
  Sandwich,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "preact/hooks";
import { SubmitHandler, useForm } from "react-hook-form";
import { useToast } from "../components/pos/Toast";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Dialog,
  Input,
  Loading,
  PageHeader,
  Select,
  Table,
  Textarea,
} from "../components/ui";
import { api } from "../lib/api";

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
  const [categories, setCategories] = useState<string[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [formValues, setFormValues] = useState<FormData>({
    code: "",
    name: "",
    price: 0,
    cost: 0,
    categoryId: undefined,
    description: undefined,
    currentStock: 0,
  });
  const [stockDisplay, setStockDisplay] = useState(0);
  const { toast } = useToast();

  const { register, handleSubmit } = useForm<FormData>({ values: formValues });

  const queryClient = useQueryClient();

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.products.list(),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (product: any) =>
      api.products.update(product.id, {
        isActive: product.isActive ? 0 : 1,
      }),
    onSuccess: (data) => {
      toast(
        data?.isActive ? "Producto desactivado" : "Producto activado",
        "success",
      );
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: () => {
      toast("Error al actualizar", "error");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => api.products.deactivate(id),
    onSuccess: () => {
      toast("Producto eliminado", "success");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: () => {
      toast("Error al eliminar", "error");
    },
  });

  useEffect(() => {
    if (productsData) {
      setProducts(productsData);
      setCategories([
        ...new Set(
          productsData.map((p: any) => p.category?.name).filter(Boolean),
        ),
      ] as string[]);
    }
  }, [productsData]);

  function openNew() {
    setEditingProduct(null);
    setFormValues({
      code: "",
      name: "",
      price: 0,
      cost: 0,
      categoryId: undefined,
      description: undefined,
      currentStock: 0,
    });
    setModalOpen(true);
  }

  function openEdit(product: any) {
    setEditingProduct(product);
    setStockDisplay(product.currentStock || 0);
    setFormValues({
      code: product.code || "",
      name: product.name || "",
      price: product.price || 0,
      cost: product.cost || 0,
      categoryId: product.categoryId || undefined,
      description: product.description || undefined,
      currentStock: 0,
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
        });
        toast("Producto creado", "success");
      }
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch {
      toast(
        editingProduct ? "Error al actualizar" : "Error al crear producto",
        "error",
      );
    }
  };

  if (isLoading) return <Loading text="Cargando..." />;

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

      <Card>
        <Table>
          <Table.Head>
            <Table.Row>
              <Table.Header>Nombre</Table.Header>
              <Table.Header className="hidden sm:table-cell">SKU</Table.Header>
              <Table.Header className="hidden md:table-cell">
                Categoría
              </Table.Header>
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
                    <span className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                      {p.category ? (
                        <CategoryIcon name={p.category.name} />
                      ) : (
                        <Package size={14} className="text-primary-600" />
                      )}
                    </span>
                    {p.name}
                  </div>
                </Table.Cell>
                <Table.Cell className="text-zinc-400 text-xs hidden sm:table-cell">
                  {p.code || "—"}
                </Table.Cell>
                <Table.Cell className="text-zinc-500 hidden md:table-cell">
                  {p.category?.name && (
                    <Badge variant="secondary">{p.category.name}</Badge>
                  )}
                </Table.Cell>
                <Table.Cell className="text-right font-semibold text-zinc-800">
                  ${p.price.toFixed(2)}
                </Table.Cell>
                <Table.Cell className="text-right">
                  <Badge
                    variant={
                      p.currentStock === 0
                        ? "danger"
                        : p.currentStock <= 5
                          ? "warning"
                          : "success"
                    }
                    dot
                  >
                    {p.currentStock}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Badge
                    variant={p.isActive ? "success" : "secondary"}
                    size="sm"
                    onClick={() => toggleActiveMutation.mutate(p)}
                    className="cursor-pointer"
                  >
                    {p.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil size={12} /> Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => removeMutation.mutate(p.id)}
                    >
                      <Trash2 size={12} /> Eliminar
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
            {products.length === 0 && (
              <Table.Empty colSpan={7}>No hay productos</Table.Empty>
            )}
          </Table.Body>
        </Table>
      </Card>

      <Dialog open={modalOpen} onClose={closeModal} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <CardHeader>
            <CardTitle>
              {editingProduct ? "Editar Producto" : "Nuevo Producto"}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeModal}
              aria-label="Cerrar"
            >
              ✕
            </Button>
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            <Input label="Nombre" {...register("name", { required: true })} />

            <div className="flex gap-3">
              <Input
                label="Precio"
                type="number"
                step="0.01"
                className="flex-1"
                {...register("price", { required: true })}
              />
              <Input
                label="Costo"
                type="number"
                step="0.01"
                className="flex-1"
                {...register("cost")}
              />
            </div>

            <div className="flex gap-3">
              <Input label="Código" className="flex-1" {...register("code")} />
              <Input
                label="Stock"
                type="number"
                className="flex-1"
                readOnly
                value={stockDisplay}
              />
            </div>

            <Select
              label="Categoría"
              {...register("categoryId")}
              options={categories.map((c: any) => ({
                value: String(c.id),
                label: c.name,
              }))}
            />

            <Textarea
              label="Descripción"
              {...register("description")}
              rows={2}
            />
          </CardContent>

          <CardFooter className="justify-end">
            <Button type="button" variant="ghost" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit">
              {editingProduct ? "Guardar cambios" : "Guardar"}
            </Button>
          </CardFooter>
        </form>
      </Dialog>
    </div>
  );
}
