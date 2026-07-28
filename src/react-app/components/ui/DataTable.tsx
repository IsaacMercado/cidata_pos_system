import { useState, useMemo, useCallback } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { Button, Input, Select } from "./index";

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ComponentChildren;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string | number;
  pageSize?: number;
  showSearch?: boolean;
  searchPlaceholder?: string;
  showPagination?: boolean;
  striped?: boolean;
  hoverable?: boolean;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
}

interface DataTableState {
  page: number;
  pageSize: number;
  sortKey: string | null;
  sortDirection: "asc" | "desc" | null;
  filters: Record<string, string>;
}

const sortIcons = {
  asc: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>,
  desc: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
  null: <svg className="w-4 h-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>,
};

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  pageSize: initialPageSize = 10,
  showSearch = true,
  searchPlaceholder = "Buscar...",
  showPagination = true,
  striped = true,
  hoverable = true,
  onRowClick,
  emptyMessage = "No hay datos",
  className = "",
}: DataTableProps<T>) {
  const [state, setState] = useState<DataTableState>({
    page: 1,
    pageSize: initialPageSize,
    sortKey: null,
    sortDirection: null,
    filters: {},
  });

  const handleSort = useCallback((key: string) => {
    setState((prev) => {
      if (prev.sortKey === key) {
        if (prev.sortDirection === "asc") return { ...prev, sortDirection: "desc" };
        if (prev.sortDirection === "desc") return { ...prev, sortKey: null, sortDirection: null };
      }
      return { ...prev, sortKey: key, sortDirection: "asc", page: 1 };
    });
  }, []);

  const handleFilterChange = useCallback((key: string, value: string) => {
    setState((prev) => ({
      ...prev,
      filters: { ...prev.filters, [key]: value },
      page: 1,
    }));
  }, []);

  const handleSearch = useCallback((value: string) => {
    setState((prev) => ({ ...prev, filters: { ...prev.filters, __search: value }, page: 1 }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setState((prev) => ({ ...prev, page }));
  }, []);

  const processedData = useMemo(() => {
    let result = [...data];

    Object.entries(state.filters).forEach(([key, value]) => {
      if (!value) return;
      if (key === "__search") {
        const searchLower = value.toLowerCase();
        result = result.filter((row) =>
          Object.values(row).some((val) => String(val).toLowerCase().includes(searchLower))
        );
      } else {
        result = result.filter((row) =>
          String(row[key] ?? "").toLowerCase().includes(value.toLowerCase())
        );
      }
    });

    if (state.sortKey && state.sortDirection) {
      result.sort((a, b) => {
        const aVal = a[state.sortKey!];
        const bVal = b[state.sortKey!];
        if (aVal === bVal) return 0;
        const comparison = aVal < bVal ? -1 : 1;
        return state.sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [data, state.filters, state.sortKey, state.sortDirection]);

  const totalPages = Math.ceil(processedData.length / state.pageSize) || 1;
  const currentPage = Math.min(state.page, totalPages);
  const startIndex = (currentPage - 1) * state.pageSize;
  const paginatedData = processedData.slice(startIndex, startIndex + state.pageSize);

  return (
    <div className={`overflow-hidden border border-neutral-200 dark:border-neutral-700 rounded-xl ${className}`}>
      {showSearch && (
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50">
          <Input
            placeholder={searchPlaceholder}
            value={state.filters.__search || ""}
            onChange={(e) => handleSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="grid">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-700">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-left font-medium text-neutral-500 dark:text-neutral-400 text-xs uppercase tracking-wider ${column.headerClassName || ""} ${column.sortable ? "cursor-pointer select-none hover:bg-neutral-100 dark:hover:bg-neutral-800" : ""}`}
                  style={{ width: column.width, userSelect: column.sortable ? "none" : "auto" }}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{column.header}</span>
                    {column.sortable && (
                      <span className="flex-shrink-0">
                        {sortIcons[state.sortKey === column.key ? state.sortDirection : null]}
                      </span>
                    )}
                    {column.filterable && (
                      <Input
                        type="text"
                        placeholder="Filtrar"
                        className="w-32 text-xs py-1 px-2 mt-1"
                        value={state.filters[column.key] || ""}
                        onChange={(e) => handleFilterChange(column.key, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-neutral-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIndex) => (
                <tr
                  key={keyExtractor(row)}
                  className={`border-t border-neutral-200 dark:border-neutral-700 transition-colors ${hoverable ? "hover:bg-neutral-50 dark:hover:bg-neutral-800/50" : ""} ${striped && rowIndex % 2 === 1 ? "bg-neutral-50 dark:bg-neutral-900/30" : ""} ${onRowClick ? "cursor-pointer" : ""}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={`px-4 py-3 ${column.className || ""}`}>
                      {column.render ? column.render(row) : String(row[column.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showPagination && totalPages > 1 && (
        <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm text-neutral-500 dark:text-neutral-400">
            Mostrando {startIndex + 1} a {Math.min(startIndex + state.pageSize, processedData.length)} de {processedData.length} resultados
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Página anterior"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </Button>
            <span className="px-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Página siguiente"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Button>
            <Select
              value={String(state.pageSize)}
              onChange={(e) => setState((prev) => ({ ...prev, pageSize: parseInt(e.target.value), page: 1 }))}
              options={[
                { value: "10", label: "10 por página" },
                { value: "25", label: "25 por página" },
                { value: "50", label: "50 por página" },
                { value: "100", label: "100 por página" },
              ]}
              className="w-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}