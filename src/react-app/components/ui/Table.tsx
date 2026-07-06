import type { ComponentChildren, JSX } from "preact";

interface TableProps extends JSX.HTMLAttributes<HTMLTableElement> {
  children: ComponentChildren;
}

function Table({ className = "", children, ...props }: TableProps) {
  return (
    <div className="overflow-hidden border border-zinc-200 rounded-xl">
      <div className="overflow-x-auto">
        <table className={`w-full text-sm ${className}`} {...props}>
          {children}
        </table>
      </div>
    </div>
  );
}

function Head({ className = "", ...props }: JSX.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`bg-zinc-50 text-left ${className}`} {...props} />;
}

function Header({ className = "", ...props }: JSX.HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wider ${className}`}
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
      className={`border-t border-zinc-100 hover:bg-indigo-50/30 transition-colors ${className}`}
      {...props}
    />
  );
}

function Cell({ className = "", ...props }: JSX.HTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-3 ${className}`} {...props} />;
}

function Empty({ colSpan, children = "No hay datos", className = "" }: { colSpan?: number; children?: ComponentChildren; className?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className={`px-4 py-12 text-center text-zinc-400 ${className}`}>
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
