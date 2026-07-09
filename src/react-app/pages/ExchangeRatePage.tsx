import { useEffect, useState } from "preact/hooks";
import { RefreshCw, DollarSign, Save } from "lucide-react";
import { Button, Loading } from "../components/ui";
import { useToast } from "../components/pos/Toast";
import { api } from "../lib/api";

export function ExchangeRatePage() {
  const [rate, setRate] = useState(0);
  const [manualRate, setManualRate] = useState("");
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    api.exchange.get().then((r: any) => {
      const usdRate = r?.USD || 0;
      if (usdRate > 0) {
        setRate(usdRate);
        setManualRate(usdRate.toFixed(2));
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function fetchBCV() {
    setFetching(true);
    try {
      const result = await api.exchange.scrape();
      if (result.success && result.rate > 0) {
        setRate(result.rate);
        setManualRate(result.rate.toFixed(2));
        toast("Tasa BCV actualizada: 1 USD = " + result.rate.toFixed(2) + " VES", "success");
      } else {
        toast("No se pudo obtener la tasa del BCV, ingrésala manualmente", "error");
      }
    } catch {
      toast("El BCV no está disponible desde el servidor local. Ingresa la tasa manualmente.", "error");
    }
    setFetching(false);
  }

  async function saveManual() {
    const value = parseFloat(manualRate);
    if (!value || value <= 0) {
      toast("Ingresa una tasa válida", "error");
      return;
    }
    setSaving(true);
    try {
      await api.exchange.create({ currencyFrom: "USD", currencyTo: "VES", rate: value });
      setRate(value);
      toast("Tasa guardada: 1 USD = " + value.toFixed(2) + " VES", "success");
    } catch {
      toast("Error al guardar la tasa", "error");
    }
    setSaving(false);
  }

  if (loading) return <Loading spinner text="Cargando..." />;

  return (
    <div className="max-w-md mx-auto mt-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Tasa de Cambio</h1>
        <p className="text-sm text-zinc-500">USD / VES — BCV</p>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <DollarSign size={24} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-500">Tasa actual</p>
              <p className="text-2xl font-bold text-zinc-900">
                {rate > 0 ? rate.toFixed(2) : "—"}
              </p>
            </div>
          </div>
          <button
            onClick={fetchBCV}
            disabled={fetching}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={fetching ? "animate-spin" : ""} />
            {fetching ? "..." : "BCV"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
          Ingreso manual
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-600">1 USD =</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={manualRate}
            onInput={(e) => setManualRate((e.target as HTMLInputElement).value)}
            className="flex-1 px-3 py-2 text-sm border border-zinc-300 rounded-xl outline-none focus:border-indigo-400"
            placeholder="0.00"
          />
          <span className="text-sm text-zinc-600">VES</span>
          <Button onClick={saveManual} disabled={saving} variant="primary">
            <Save size={16} />
            {saving ? "..." : "Guardar"}
          </Button>
        </div>
      </div>

      <p className="text-xs text-zinc-400 text-center">
        La tasa se obtiene del BCV. Si el servidor no responde, ingrésala manualmente.
      </p>
    </div>
  );
}