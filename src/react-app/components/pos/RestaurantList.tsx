import { useState } from "preact/hooks";
import { useLocation, useRoute } from "wouter-preact";
import { Button, Card } from "../../components/ui";
import { useToast } from "./Toast";
import { api } from "../../lib/api";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";

interface RestaurantListProps {
  onSelect: (id: number) => void;
}

export function RestaurantList({ onSelect }: RestaurantListProps) {
  const [list, setList] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const restForm = { defaultValues: { name: "", description: "" } };

  async function loadList() {
    try {
      const data = await api.restaurants.list();
      setList(data || []);
    } catch {}
    setLoading(false);
  }

  const onSaveRestaurant = async (data: any) => {
    try {
      await api.restaurants.create(data);
      setShowForm(false);
      restForm.defaultValues = { name: "", description: "" };
      await loadList();
    } catch {}
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Restaurantes</h2>
          <p className="text-sm text-slate-500">Administra salones y abre el mapa de mesas.</p>
        </div>
        <Button variant={showForm ? "ghost" : "accent"} onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancelar" : <> <Plus size={14} className="mr-1" /> Nuevo restaurante </>}
        </Button>
      </div>

      {showForm && (
        <form className="mb-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-[0_20px_45px_rgba(15,23,42,0.08)]" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); onSaveRestaurant({ name: fd.get("name"), description: fd.get("description") }); }}>
          <div className="space-y-3">
            <Input label="Nombre" name="name" required />
            <Input label="Descripción" name="description" />
          </div>
          <Button variant="accent" className="mt-3 w-full">Guardar</Button>
        </form>
      )}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-6 w-3/4 bg-slate-200 rounded mb-2" />
              <div className="h-4 w-1/2 bg-slate-200 rounded mb-4" />
              <div className="flex gap-2">
                <div className="h-8 w-full bg-slate-200 rounded flex-1" />
                <div className="h-8 w-full bg-slate-200 rounded flex-1" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((item: any) => (
            <Card key={item.id}>
              <div className="mb-4">
                <h3 className="font-semibold">{item.name}</h3>
                <p className="text-sm text-slate-500">{item.description || "Sin descripción"}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="accent" size="sm" className="flex-1" onClick={() => onSelect(item.id)}>
                  Abrir mesas
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/restaurants/${item.id}/layout`)}>
                  Diseño
                </Button>
              </div>
            </Card>
          ))}
          {list.length === 0 && <div className="py-12 text-center text-sm text-slate-400">Crea un restaurante para empezar.</div>}
        </div>
      )}
    </div>
  );
}