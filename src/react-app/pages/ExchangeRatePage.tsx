import { DollarSign } from "lucide-react";
import { useEffect, useState } from "preact/hooks";
import { Loading } from "../components/ui";
import { api } from "../lib/api";

export function ExchangeRatePage() {
  const [rate, setRate] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.exchange.get().then((r: any) => {
      const usdRate = r?.USD || 0;
      if (usdRate > 0) setRate(usdRate);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading spinner text="Cargando..." />;

  return (
    <div className="max-w-md mx-auto mt-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Tasa de Cambio</h1>
        <p className="text-sm text-zinc-500">USD / VES — BCV</p>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 p-6">
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
      </div>
    </div>
  );
}
