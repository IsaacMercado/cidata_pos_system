import { useState } from "preact/hooks";
import { useRoute } from "wouter-preact";

const links = [
  { href: "/", label: "POS", icon: "⊞" },
  { href: "/products", label: "Productos", icon: "■" },
  { href: "/customers", label: "Clientes", icon: "●" },
  { href: "/sales", label: "Ventas", icon: "≡" },
  { href: "/restaurants", label: "Restaurante", icon: "◉" },
];

interface SidebarProps {
  userEmail?: string;
  onLoginClick: () => void;
}

export function Sidebar({ userEmail, onLoginClick }: SidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-3 left-3 z-50 md:hidden bg-zinc-900 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
      >
        <span className="text-lg">{open ? "\u2715" : "\u2630"}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-zinc-900 text-zinc-100 flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="px-5 py-5 border-b border-zinc-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-sm font-bold">
            P
          </div>
          <div>
            <h1 className="font-bold tracking-tight">pos-system</h1>
            <p className="text-[10px] text-zinc-500">Punto de Venta</p>
          </div>
        </div>

        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {links.map((link) => {
            const [isActive] = useRoute(link.href === "/" ? "/" : link.href);
            return (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  window.history.pushState(null, "", link.href);
                  window.dispatchEvent(new Event("popstate"));
                }}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors ${
                  isActive
                    ? "bg-indigo-500/20 text-indigo-300 font-medium"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                <span className="w-5 text-center">{link.icon}</span>
                {link.label}
              </a>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-zinc-800 space-y-2">
          {userEmail && (
            <p className="text-xs text-zinc-500 truncate">{userEmail}</p>
          )}
          <button
            onClick={onLoginClick}
            className="w-full py-2 text-xs text-zinc-400 hover:text-red-400 transition-colors text-left"
          >
            {userEmail ? "Cerrar Sesión" : "Iniciar Sesión"}
          </button>
        </div>
      </aside>
    </>
  );
}
