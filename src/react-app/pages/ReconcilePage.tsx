import { FileSpreadsheet } from "lucide-react";
import { FileIO, PageHeader } from "../components/ui";

const RECONCILE_ENDPOINT = "/api/reconcile";

export function ReconcilePage() {
  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <PageHeader
        title="Conciliación de pagos"
        description="Sube el Excel/CSV del banco, procesa y exporta el resultado de la conciliación contra los pagos del sistema."
        icon={FileSpreadsheet}
      />
      <FileIO
        title="Movimientos del banco"
        description="Sube un archivo Excel (.xlsx), CSV o ZIP con varios CSV. La hoja activa se envía al servidor para conciliar contra los pagos registrados."
        endpoint={RECONCILE_ENDPOINT}
      />
    </div>
  );
}
