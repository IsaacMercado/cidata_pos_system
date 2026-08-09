import type { ComponentChildren, JSX } from "preact";

interface TableProps extends JSX.HTMLAttributes<HTMLTableElement> {
  children: ComponentChildren;
}

function Table({ className = "", children, ...props }: TableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-pos-border dark:border-neutral-700">
      <div className="overflow-x-auto">
        <table className={`w-full text-sm ${className}`} {...props}>
          {children}
        </table>
      </div>
    </div>
  );
}

function Head({ className = "", ...props }: JSX.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`bg-neutral-50 text-left dark:bg-neutral-800/70 ${className}`} {...props} />;
}

function Header({ className = "", ...props }: JSX.HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`px-4 py-3 font-semibold text-neutral-500 text-xs uppercase tracking-wider dark:text-neutral-400 ${className}`}
      {...props}
    />
  );
}

function Body({ className = "", ...props }: JSX.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

function Row({ className = "", ...props }: JSX.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={`border-t border-neutral-100 hover:bg-primary-50/50 dark:border-neutral-800 dark:hover:bg-neutral-800/60 transition-colors ${className}`}
      {...props}
    />
  );
}

function Cell({ className = "", ...props }: JSX.HTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-3 text-neutral-700 dark:text-neutral-200 ${className}`} {...props} />;
}

function Empty({ colSpan, children = "No hay datos", className = "" }: { colSpan?: number; children?: ComponentChildren; className?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className={`px-4 py-12 text-center text-neutral-400 dark:text-neutral-500 ${className}`}>
        {children}
      </td>
    </tr>
  );
}

Table.Head = Head;
Table.Header = Header;
Table.Body = Body;
Table.Row = Row;
Table.Cell = Cell;
Table.Empty = Empty;

export { Table };
