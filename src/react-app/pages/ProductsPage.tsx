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
import type { ProductWithCategory } from "../lib/types";

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
  barcode: string;
  taxRate: number;
  unit: string;
  productType: "simple" | "combo" | "reservation";
  minStock: number;
  catalogStatus: "active" | "needs_review" | "inactive";
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
    barcode: "",
    taxRate: 0,
    unit: "unit",
    productType: "simple",
    minStock: 0,
    catalogStatus: "needs_review",
  });
  const [comboItems, setComboItems] = useState<any[]>([]);
  const [recipeItems, setRecipeItems] = useState<any[]>([]);
  const [countProduct, setCountProduct] = useState<any | null>(null);
  const [countValue, setCountValue] = useState(0);
  const [countSaving, setCountSaving] = useState(false);
  const [stockDisplay, setStockDisplay] = useState(0);
  const [variantGroupName, setVariantGroupName] = useState("");
  const [variantAttributeText, setVariantAttributeText] = useState("");
  const [newVariantCode, setNewVariantCode] = useState("");
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantPrice, setNewVariantPrice] = useState(0);
  const [newVariantValues, setNewVariantValues] = useState("");
  const { toast } = useToast();

  const { register, handleSubmit, watch } = useForm<FormData>({ values: formValues });
  const productType = watch("productType");

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

  useEffect(() => {
    if (editingProduct?.id && productType === "combo") {
      api.comboItems.list(editingProduct.id).then((res) => setComboItems(res || [])).catch(() => {});
      setRecipeItems([]);
    } else if (editingProduct?.id && productType !== "reservation") {
      api.inventory.recipe(editingProduct.id).then((res) => setRecipeItems(res?.items || [])).catch(() => setRecipeItems([]));
      setComboItems([]);
    } else {
      setComboItems([]);
      setRecipeItems([]);
    }
  }, [editingProduct?.id, productType]);

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
      barcode: "",
      taxRate: 0,
      unit: "unit",
      productType: "simple",
      minStock: 0,
      catalogStatus: "needs_review",
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
      barcode: product.barcode || "",
      taxRate: product.taxRate || 0,
      unit: product.unit || "unit",
      productType: product.productType || "simple",
      minStock: product.minStock || 0,
      catalogStatus: product.catalogStatus || (product.isActive ? "active" : "inactive"),
    });
    setVariantGroupName(product.variantGroup?.name || product.name + " - Variantes");
    setVariantAttributeText((product.variantAttributes || []).join(", "));
    setNewVariantCode("");
    setNewVariantName("");
    setNewVariantPrice(product.price || 0);
    setNewVariantValues("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingProduct(null);
  }

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      const payload = {
        code: data.code,
        name: data.name,
        price: data.price,
        cost: data.cost || 0,
        categoryId: data.categoryId || undefined,
        description: data.description || undefined,
        barcode: data.barcode || undefined,
        taxRate: data.taxRate || 0,
        unit: data.unit || "unit",
        productType: data.productType || "simple",
        minStock: data.minStock || 0,
        catalogStatus: data.catalogStatus,
      };
      let productId = editingProduct?.id;
      if (editingProduct) {
        await api.products.update(editingProduct.id, payload);
        toast("Producto actualizado", "success");
      } else {
        const created = await api.products.create({
          ...payload,
          code: data.code || `PROD-${Date.now()}`,
        });
        productId = created.id;
        toast("Producto creado", "success");
      }

      if (productId && (variantGroupName.trim() || variantAttributeText.trim())) {
        const group = editingProduct?.variantGroupId
          ? { id: editingProduct.variantGroupId }
          : await api.products.createVariantGroup({
              productId,
              name: variantGroupName.trim() || `${data.name} - Variantes`,
              attributes: variantAttributeText.split(",").map((value) => value.trim()).filter(Boolean),
            });
        for (const [position, name] of variantAttributeText.split(",").map((value) => value.trim()).filter(Boolean).entries()) {
          await api.products.createVariantAttribute(group.id, { name, position }).catch(() => {});
        }
        if (newVariantName.trim() && newVariantCode.trim()) {
          const variantProduct = await api.products.create({
            code: newVariantCode.trim(),
            name: newVariantName.trim(),
            price: newVariantPrice,
            cost: data.cost || 0,
            categoryId: data.categoryId || undefined,
            taxRate: data.taxRate || 0,
            unit: data.unit || "unit",
            productType: "simple",
            catalogStatus: "active",
          });
          const values = Object.fromEntries(newVariantValues.split(",").map((entry) => entry.split("=").map((part) => part.trim())).filter(([key, value]) => key && value));
          await api.products.createVariant(group.id, { productId: variantProduct.id, values });
        }
      }

      // Save combo items
      if (data.productType === "combo" && productId) {
        const existing = await api.comboItems.list(productId).catch(() => []);
        for (const item of existing) {
          await api.comboItems.remove(item.id).catch(() => {});
        }
        for (const item of comboItems) {
          await api.comboItems.create({
            comboProductId: productId,
            componentProductId: item.componentProductId,
            quantity: item.quantity,
          }).catch(() => {});
        }
      }

      if (data.productType !== "reservation" && productId && recipeItems.length > 0) {
        await api.inventory.saveRecipe(productId, recipeItems.map((item) => ({
          componentProductId: item.componentProductId,
          quantity: item.quantity,
        })));
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
                        : p.minStock > 0 && p.currentStock <= p.minStock
                          ? "warning"
                          : "success"
                    }
                    dot
                  >
                    {p.currentStock}
                    {p.minStock > 0 && (
                      <span className="text-[10px] opacity-60 ml-1">/ {p.minStock}</span>
                    )}
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
                  {p.catalogStatus === "needs_review" && (
                    <Badge variant="warning" size="sm">Revisar</Badge>
                  )}
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
                      onClick={() => {
                        setCountProduct(p);
                        setCountValue(p.currentStock || 0);
                      }}
                    >
                      Contar
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
                {...register("price", { required: true, valueAsNumber: true })}
              />
              <Input
                label="Costo"
                type="number"
                step="0.01"
                className="flex-1"
                {...register("cost", { valueAsNumber: true })}
              />
            </div>

            <div className="flex gap-3">
              <Input label="Código" className="flex-1" {...register("code")} />
              <Input label="Código Barras" className="flex-1" {...register("barcode")} />
            </div>

            <div className="flex gap-3">
              <Input
                label="Stock"
                type="number"
                className="flex-1"
                readOnly
                value={stockDisplay}
              />
              <Input
                label="Stock Mínimo"
                type="number"
                step="1"
                className="flex-1"
                {...register("minStock", { valueAsNumber: true })}
              />
            </div>

            <div className="flex gap-3">
              <Input
                label="Impuesto (%)"
                type="number"
                step="0.01"
                className="flex-1"
                {...register("taxRate", { valueAsNumber: true })}
              />
              <Input label="Unidad" className="flex-1" {...register("unit")} />
            </div>

            <Select
              label="Tipo de Producto"
              {...register("productType")}
              options={[
                { value: "simple", label: "Simple" },
                { value: "combo", label: "Combo (paquete)" },
                { value: "reservation", label: "Reservación" },
              ]}
            />

            <Select
              label="Estado del catálogo"
              {...register("catalogStatus")}
              options={[
                { value: "needs_review", label: "Pendiente de revisar" },
                { value: "active", label: "Listo para operar" },
                { value: "inactive", label: "Inactivo" },
              ]}
            />

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

            <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
              <p className="text-xs font-semibold uppercase text-violet-700">Variantes</p>
              <Input label="Grupo" value={variantGroupName} onChange={(event) => setVariantGroupName((event.target as HTMLInputElement).value)} placeholder="Ej. Presentación" />
              <Input label="Atributos separados por coma" value={variantAttributeText} onChange={(event) => setVariantAttributeText((event.target as HTMLInputElement).value)} placeholder="Tamaño, Color" />
              <p className="text-xs text-zinc-500">Cada variante vendible conserva su propio producto, SKU, precio y stock.</p>
              <div className="grid grid-cols-2 gap-2 border-t border-violet-200 pt-2">
                <Input label="SKU variante" value={newVariantCode} onChange={(event) => setNewVariantCode((event.target as HTMLInputElement).value)} placeholder="CAF-GDE" />
                <Input label="Nombre variante" value={newVariantName} onChange={(event) => setNewVariantName((event.target as HTMLInputElement).value)} placeholder="Café grande" />
                <Input label="Precio variante" type="number" step="0.01" value={newVariantPrice} onChange={(event) => setNewVariantPrice(Number((event.target as HTMLInputElement).value) || 0)} />
                <Input label="Valores" value={newVariantValues} onChange={(event) => setNewVariantValues((event.target as HTMLInputElement).value)} placeholder="Tamaño=Grande, Color=Negro" />
              </div>
            </div>

            {productType === "combo" && (
              <ComboItemsEditor
                items={comboItems}
                allProducts={products}
                onChange={setComboItems}
              />
            )}

            {productType !== "reservation" && (
              <RecipeEditor
                items={recipeItems}
                allProducts={products}
                targetProductId={editingProduct?.id}
                onChange={setRecipeItems}
              />
            )}
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

      <Dialog open={!!countProduct} onClose={() => setCountProduct(null)} size="sm">
        {countProduct && (
          <form
            className="p-6 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setCountSaving(true);
              try {
                await api.inventory.count({ productId: countProduct.id, countedStock: countValue, notes: "Conteo físico desde catálogo" });
                toast("Conteo registrado", "success");
                setCountProduct(null);
                queryClient.invalidateQueries({ queryKey: ["products"] });
              } catch (error) {
                toast(error instanceof Error ? error.message : "Error al registrar conteo", "error");
              } finally {
                setCountSaving(false);
              }
            }}
          >
            <CardTitle>Conteo físico</CardTitle>
            <p className="text-sm text-zinc-500">{countProduct.name}</p>
            <p className="text-xs text-zinc-500">Saldo registrado: {countProduct.currentStock} {countProduct.unit}</p>
            <Input label="Cantidad contada" type="number" min="0" step="0.001" value={countValue} onChange={(event) => setCountValue(Number((event.target as HTMLInputElement).value) || 0)} />
            <CardFooter className="justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCountProduct(null)}>Cancelar</Button>
              <Button type="submit" disabled={countSaving}>{countSaving ? "Guardando..." : "Registrar conteo"}</Button>
            </CardFooter>
          </form>
        )}
      </Dialog>
    </div>
  );
}

function RecipeEditor({
  items,
  allProducts,
  targetProductId,
  onChange,
}: {
  items: any[];
  allProducts: ProductWithCategory[];
  targetProductId?: number;
  onChange: (items: any[]) => void;
}) {
  const [componentId, setComponentId] = useState("");
  const [componentQty, setComponentQty] = useState("1");
  const availableProducts = allProducts.filter((product) =>
    product.productType === "simple" && product.id !== targetProductId && !items.some((item) => item.componentProductId === product.id),
  );

  function addItem() {
    const product = availableProducts.find((item) => item.id === Number(componentId));
    const quantity = Number(componentQty);
    if (!product || !Number.isFinite(quantity) || quantity <= 0) return;
    onChange([...items, { componentProductId: product.id, quantity, productName: product.name }]);
    setComponentId("");
    setComponentQty("1");
  }

  return (
    <div className="space-y-2 border border-amber-200 bg-amber-50/40 rounded-xl p-3">
      <p className="text-xs font-semibold text-amber-700 uppercase">Receta / consumo teórico</p>
      <p className="text-xs text-zinc-500">Al vender este producto se estimará el consumo de sus ingredientes.</p>
      {items.map((item, index) => (
        <div key={`${item.componentProductId}-${index}`} className="flex items-center gap-2 text-sm">
          <span className="flex-1">{item.productName || `Producto #${item.componentProductId}`}</span>
          <span>x{item.quantity}</span>
          <button type="button" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} className="text-red-500">Quitar</button>
        </div>
      ))}
      <div className="flex gap-2">
        <select value={componentId} onChange={(event) => setComponentId(event.currentTarget.value)} className="flex-1 text-sm border border-zinc-300 rounded-lg px-2 py-1.5 bg-white">
          <option value="">Seleccionar ingrediente...</option>
          {availableProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
        </select>
        <input type="number" min="0.001" step="0.001" value={componentQty} onChange={(event) => setComponentQty(event.currentTarget.value)} className="w-20 text-sm border border-zinc-300 rounded-lg px-2 py-1.5 text-center" />
        <Button type="button" onClick={addItem} size="sm" disabled={!componentId}><Plus size={14} /></Button>
      </div>
    </div>
  );
}

// ─── Combo Items Editor ─────────────────────────────────────────────────────

function ComboItemsEditor({
  items,
  allProducts,
  onChange,
}: {
  items: any[];
  allProducts: ProductWithCategory[];
  onChange: (items: any[]) => void;
}) {
  const [componentId, setComponentId] = useState("");
  const [componentQty, setComponentQty] = useState("1");

  const availableProducts = allProducts.filter(
    (p) => p.productType === "simple" && !items.find((i) => i.componentProductId === p.id),
  );

  function addItem() {
    if (!componentId) return;
    const prod = allProducts.find((p) => p.id === Number(componentId));
    if (!prod) return;
    onChange([...items, { componentProductId: Number(componentId), quantity: Number(componentQty) || 1, productName: prod.name }]);
    setComponentId("");
    setComponentQty("1");
  }

  function removeItem(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3">
      <p className="text-xs font-semibold text-zinc-500 uppercase">Componentes del Combo</p>
      {items.length === 0 && <p className="text-xs text-zinc-400">Sin componentes. Agrega productos simples al combo.</p>}
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          <span className="flex-1 text-zinc-700">{item.productName || `Producto #${item.componentProductId}`}</span>
          <span className="text-zinc-500">x{item.quantity}</span>
          <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700 text-xs">✕</button>
        </div>
      ))}
      <div className="flex gap-2">
        <select
          value={componentId}
          onChange={(e) => setComponentId(e.currentTarget.value)}
          className="flex-1 text-sm border border-zinc-300 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="">Seleccionar producto...</option>
          {availableProducts.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          type="number"
          min="1"
          value={componentQty}
          onChange={(e) => setComponentQty(e.currentTarget.value)}
          className="w-16 text-sm border border-zinc-300 rounded-lg px-2 py-1.5 text-center"
        />
        <Button onClick={addItem} size="sm" disabled={!componentId}><Plus size={14} /></Button>
      </div>
    </div>
  );
}
