import { useCallback, useMemo, useRef, useState } from "preact/hooks";
import { useToast } from "../../components/pos/Toast";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./index";
import {
  type WorkbookData,
  downloadCsv,
  downloadCsvZip,
  downloadXlsx,
  isSupportedFile,
  parseCsvText,
  parseFile,
  sheetToCsv,
  unzipCsvBufferToWorkbook,
} from "../../lib/fileio";

const MAX_PREVIEW_ROWS = 100;

interface FileIOProps {
  title?: string;
  description?: string;
  accept?: string;
  endpoint?: string;
  showExportZip?: boolean;
  onLoaded?: (workbook: WorkbookData) => void;
  onProcessed?: (workbook: WorkbookData) => void;
}

export function FileIO({
  title = "Cargar datos",
  description = "Sube un archivo Excel (.xlsx), CSV o ZIP con varios CSV para ver y exportar los datos.",
  accept = ".xlsx,.xls,.csv,.zip",
  endpoint,
  showExportZip = false,
  onLoaded,
  onProcessed,
}: FileIOProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null);
  const [result, setResult] = useState<WorkbookData | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);

  const current = result ?? workbook;
  const sheet = current?.sheets[activeSheet];

  const handleFile = useCallback(
    async (file: File) => {
      if (!isSupportedFile(file)) {
        toast(`Formato no soportado: ${file.name}`, "error");
        return;
      }
      try {
        const parsed = await parseFile(file);
        if (parsed.sheets.length === 0) {
          toast("El archivo no contiene hojas con datos", "error");
          return;
        }
        setWorkbook(parsed);
        setResult(null);
        setActiveSheet(0);
        onLoaded?.(parsed);
        toast(`Cargado: ${parsed.sheets.length} hoja(s)`);
      } catch (err) {
        console.error("[FileIO] Error al leer", file.name, err);
        toast(`Error al leer ${file.name}: ${(err as Error).message}`, "error");
      }
    },
    [toast, onLoaded],
  );

  const handleInputChange = useCallback(
    (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFile(file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleProcess = useCallback(async () => {
    if (!sheet || !endpoint) return;
    setProcessing(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/csv;charset=utf-8" },
        credentials: "same-origin",
        body: sheetToCsv(sheet),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.message || `HTTP ${res.status}`);
      }

      const contentType = res.headers.get("Content-Type") ?? "";
      let parsed: WorkbookData;
      if (contentType.includes("application/zip")) {
        parsed = unzipCsvBufferToWorkbook(sheet.name, await res.arrayBuffer());
      } else if (contentType.includes("text/csv")) {
        parsed = parseCsvText(`${sheet.name}.csv`, await res.text());
      } else {
        const json = await res.json().catch(() => null);
        if (json && typeof json === "object" && Array.isArray((json as { sheets?: unknown[] }).sheets)) {
          parsed = json as unknown as WorkbookData;
        } else {
          throw new Error("Respuesta inesperada del servidor");
        }
      }

      if (parsed.sheets.length === 0) {
        toast("La respuesta no contiene hojas con datos", "error");
        return;
      }
      setResult(parsed);
      setActiveSheet(0);
      onProcessed?.(parsed);
      toast(`Procesado: ${parsed.sheets.length} hoja(s) de resultado`);
    } catch (err) {
      console.error("[FileIO] Error al procesar", err);
      toast(`Error al procesar: ${(err as Error).message}`, "error");
    } finally {
      setProcessing(false);
    }
  }, [sheet, endpoint, toast, onProcessed]);

  const previewRows = useMemo(() => {
    if (!sheet) return [];
    return sheet.rows.slice(0, MAX_PREVIEW_ROWS);
  }, [sheet]);

  const stats = useMemo(() => {
    if (!sheet) return null;
    return { rows: sheet.rows.length, cols: sheet.headers.length };
  }, [sheet]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            dragging
              ? "border-primary-500 bg-primary-50/50 dark:bg-primary-500/10"
              : "border-neutral-300 dark:border-neutral-600 hover:border-primary-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
          }`}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={handleInputChange}
          />
          <svg className="mx-auto h-10 w-10 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 12v9m0-9l-3-3m3 3l3-3" />
          </svg>
          <p className="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-200">
            Arrastra un archivo o haz clic para seleccionar
          </p>
          <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
            {accept.split(",").join(" · ")}
          </p>
        </div>

        {sheet && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {current!.sheets.length > 1 && (
                  <select
                    value={String(activeSheet)}
                    onChange={(e) => setActiveSheet(parseInt((e.target as HTMLSelectElement).value, 10))}
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                  >
                    {current!.sheets.map((s, i) => (
                      <option key={s.name} value={String(i)}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
                {stats && (
                  <span className="text-xs text-neutral-400 dark:text-neutral-500">
                    {stats.rows} filas · {stats.cols} columnas
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => downloadCsv(sheet)}>
                  Exportar CSV
                </Button>
                {showExportZip && current && (
                  <Button variant="outline" size="sm" onClick={() => downloadCsvZip(current)}>
                    Exportar ZIP
                  </Button>
                )}
                {current && (
                  <Button variant="outline" size="sm" onClick={() => downloadXlsx(current)}>
                    Exportar Excel
                  </Button>
                )}
              </div>
            </div>

            {endpoint && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/50">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  Envía esta hoja al servidor y recibe el resultado:
                </span>
                <Button variant="accent" size="sm" loading={processing} onClick={handleProcess}>
                  Procesar
                </Button>
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700">
              <div className="overflow-x-auto" style={{ maxHeight: "22rem" }}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-neutral-50 text-left dark:bg-neutral-800/95">
                    <tr>
                      {sheet.headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 font-semibold text-neutral-500 text-xs uppercase tracking-wider dark:text-neutral-400 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.length === 0 ? (
                      <tr>
                        <td colSpan={sheet.headers.length} className="px-3 py-10 text-center text-neutral-400">
                          Sin filas de datos
                        </td>
                      </tr>
                    ) : (
                      previewRows.map((row, i) => (
                        <tr key={i} className="border-t border-neutral-100 dark:border-neutral-800">
                          {sheet.headers.map((_, c) => (
                            <td key={c} className="px-3 py-2 text-neutral-700 dark:text-neutral-200 whitespace-nowrap max-w-60 truncate">
                              {row[c] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {sheet.rows.length > MAX_PREVIEW_ROWS && (
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                Mostrando las primeras {MAX_PREVIEW_ROWS} de {sheet.rows.length} filas.
              </p>
            )}
          </div>
        )}
      </CardContent>
      {current && (
        <CardFooter className="justify-between">
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            {result ? "Resultado del servidor" : workbook?.name ?? ""}
          </span>
          {result && (
            <Button variant="success" size="sm" onClick={() => downloadXlsx(result)}>
              Exportar resultado a Excel
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
