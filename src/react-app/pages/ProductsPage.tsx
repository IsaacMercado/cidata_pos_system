import { Package } from "lucide-react";
import { useState } from "preact/hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../components/pos/Toast";
import { Badge, Button, Card, CardFooter, Dialog, Input, Loading, PageHeader, Table } from "../components/ui";
import { api } from "../lib/api";

export function ProductsPage() {
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.products.list(),
  });
  const [countProduct, setCountProduct] = useState<any | null>(null);
  const [countValue, setCountValue] = useState(0);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (isLoading) return <Loading text="Cargando..." />;

  async function saveCount(event: Event) {
    event.preventDefault();
    if (!countProduct) return;
    setSaving(true);
    try {
      await api.inventory.count({ productId: countProduct.id, countedStock: countValue, notes: "Conteo físico desde catálogo" });
      toast("Conteo registrado", "success");
      setCountProduct(null);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error al registrar conteo", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <PageHeader title="Catálogo operativo" description="Catálogo publicado desde Odoo. Solo se permite registrar conteos físicos." icon={Package} />
      <Card>
        <Table>
          <Table.Head><Table.Row>
            <Table.Header>Producto</Table.Header>
            <Table.Header className="hidden sm:table-cell">SKU</Table.Header>
            <Table.Header>Precio</Table.Header>
            <Table.Header>Proyección</Table.Header>
            <Table.Header>Acción</Table.Header>
          </Table.Row></Table.Head>
          <Table.Body>
             {products.map((product: any) => (
              <Table.Row key={product.id}>
                <Table.Cell className="font-medium text-zinc-800">{product.name}</Table.Cell>
                <Table.Cell className="text-zinc-400 text-xs hidden sm:table-cell">{product.code || "-"}</Table.Cell>
                <Table.Cell className="font-semibold">${Number(product.price).toFixed(2)}</Table.Cell>
                <Table.Cell>
                 <Badge variant={(product.stockProjection ?? product.currentStock) === 0 ? "danger" : "success"} dot>
                   {product.stockProjection ?? product.currentStock}
                 </Badge>
                 {product.stockOfficial != null && product.stockOfficial !== (product.stockProjection ?? product.currentStock) && (
                   <span className="ml-2 text-[10px] text-amber-600" title="Difiere del stock oficial de Odoo">difiere de Odoo</span>
                 )}
                </Table.Cell>
                <Table.Cell><Button variant="ghost" size="sm" onClick={() => { setCountProduct(product); setCountValue(product.stockProjection ?? product.currentStock ?? 0); }}>Contar</Button></Table.Cell>
              </Table.Row>
            ))}
            {products.length === 0 && <Table.Empty colSpan={5}>No hay productos publicados</Table.Empty>}
          </Table.Body>
        </Table>
      </Card>

      <Dialog open={!!countProduct} onClose={() => setCountProduct(null)} size="sm">
        {countProduct && <form className="p-6 space-y-4" onSubmit={saveCount}>
          <h2 className="text-lg font-semibold">Conteo físico</h2>
          <p className="text-sm text-zinc-500">{countProduct.name} · proyección operativa</p>
          <Input label="Cantidad contada" type="number" min="0" step="0.001" value={countValue} onChange={(event) => setCountValue(Number((event.target as HTMLInputElement).value) || 0)} />
          <CardFooter className="justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCountProduct(null)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Registrar conteo"}</Button>
          </CardFooter>
        </form>}
      </Dialog>
    </div>
  );
}
