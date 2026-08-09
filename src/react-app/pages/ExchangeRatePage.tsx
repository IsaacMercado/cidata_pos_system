import { DollarSign } from "lucide-react";
import { useEffect, useState } from "preact/hooks";
import { Card, CardContent, CardDescription, CardTitle, Loading, PageHeader, Button, Input, Select } from "../components/ui";
import { api } from "../lib/api";
import { useToast } from "../components/pos/Toast";

export function ExchangeRatePage() {
  const [rates, setRates] = useState<Array<{ id: number; currencyFrom: string; currencyTo: string; rate: number; fetchedAt: string }>>([]);
  const [form, setForm] = useState({ currencyFrom: "USD", currencyTo: "VES", rate: "" });
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRates();
  }, []);

  async function loadRates() {
    try { setRates(await api.exchange.list()); } catch { toast("No se pudieron cargar las tasas", "error"); } finally { setLoading(false); }
  }

  async function saveRate(event: Event) {
    event.preventDefault();
    const rate = Number(form.rate);
    if (!Number.isFinite(rate) || rate <= 0) return;
    setSaving(true);
    try { await api.exchange.create({ ...form, rate }); setForm({ ...form, rate: "" }); toast("Tasa guardada", "success"); await loadRates(); } catch { toast("No se pudo guardar la tasa", "error"); } finally { setSaving(false); }
  }

  async function scrape(save: boolean) {
    setScraping(true);
    try { if (save) { await api.exchange.scrapeAndSave(); toast("Tasas BCV actualizadas", "success"); } else { const result = await api.exchange.scrape(); toast(`BCV: ${Object.keys(result.rates).length} tasas encontradas`, "success"); } await loadRates(); } catch (error) { toast(error instanceof Error ? error.message : "No se pudo consultar el BCV", "error"); } finally { setScraping(false); }
  }

  if (loading) return <Loading spinner text="Cargando..." />;

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <PageHeader title="Tasas de cambio" description="Consulta, registra y actualiza las tasas del sistema" icon={DollarSign} action={<Button onClick={() => scrape(true)} disabled={scraping}>{scraping ? "Consultando..." : "Actualizar desde BCV"}</Button>} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm"><thead className="bg-neutral-50 text-left dark:bg-neutral-800/70"><tr><th className="px-4 py-3">Origen</th><th className="px-4 py-3">Destino</th><th className="px-4 py-3 text-right">Tasa</th><th className="px-4 py-3">Fecha</th></tr></thead><tbody>
                {rates.map((item) => <tr key={item.id} className="border-t border-neutral-100 dark:border-neutral-800"><td className="px-4 py-3 font-semibold">{item.currencyFrom}</td><td className="px-4 py-3">{item.currencyTo}</td><td className="px-4 py-3 text-right font-semibold">{item.rate.toFixed(6)}</td><td className="px-4 py-3 text-xs text-neutral-500">{item.fetchedAt}</td></tr>)}
                {rates.length === 0 && <tr><td colSpan={4} className="px-4 py-12 text-center text-neutral-400">No hay tasas registradas</td></tr>}
              </tbody></table>
            </div>
          </CardContent>
        </Card>
        <Card><CardContent className="space-y-4"><div><CardTitle>Agregar tasa</CardTitle><CardDescription>Registra una tasa manualmente.</CardDescription></div><form className="space-y-4" onSubmit={saveRate}>
          <Select label="Moneda origen" value={form.currencyFrom} onChange={(e) => setForm({ ...form, currencyFrom: (e.target as HTMLSelectElement).value })} options={[{ value: "USD", label: "USD" }, { value: "EUR", label: "EUR" }, { value: "CNY", label: "CNY" }, { value: "RUB", label: "RUB" }, { value: "TRY", label: "TRY" }]} />
          <Input label="Moneda destino" value={form.currencyTo} onInput={(e) => setForm({ ...form, currencyTo: (e.currentTarget as HTMLInputElement).value.toUpperCase() })} maxLength={3} />
          <Input label="Valor" type="number" step="0.000001" min="0" value={form.rate} onInput={(e) => setForm({ ...form, rate: (e.currentTarget as HTMLInputElement).value })} required />
          <Button type="submit" fullWidth disabled={saving}>{saving ? "Guardando..." : "Guardar tasa"}</Button>
        </form></CardContent></Card>
      </div>
    </div>
  );
}
