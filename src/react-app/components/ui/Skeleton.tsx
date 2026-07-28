export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-neutral-200 dark:bg-neutral-700 rounded ${className}`}
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded mb-2 animate-pulse" style={{ width: i === lines - 1 ? "60%" : "100%" }} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 animate-pulse ${className}`}>
      <div className="h-6 w-3/4 bg-neutral-200 dark:bg-neutral-700 rounded mb-2" />
      <div className="h-4 w-1/2 bg-neutral-200 dark:bg-neutral-700 rounded mb-4" />
      <div className="space-y-2">
        <div className="h-4 w-full bg-neutral-200 dark:bg-neutral-700 rounded" />
        <div className="h-4 w-5/6 bg-neutral-200 dark:bg-neutral-700 rounded" />
        <div className="h-4 w-2/3 bg-neutral-200 dark:bg-neutral-700 rounded" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4, className = "" }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={`overflow-hidden border border-neutral-200 dark:border-neutral-700 rounded-xl ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-100 dark:bg-neutral-800">
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <div className="h-4 w-3/4 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, row) => (
              <tr key={row} className="border-t border-neutral-200 dark:border-neutral-700">
                {Array.from({ length: cols }).map((_, col) => (
                  <td key={col} className="px-4 py-3">
                    <div className="h-4 w-full bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SkeletonList({ items = 5, className = "" }: { items?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div className="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-700" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/4 bg-neutral-200 dark:bg-neutral-700 rounded" />
            <div className="h-3 w-1/3 bg-neutral-200 dark:bg-neutral-700 rounded" />
          </div>
          <div className="h-6 w-20 bg-neutral-200 dark:bg-neutral-700 rounded" />
        </div>
      ))}
    </div>
  );
}