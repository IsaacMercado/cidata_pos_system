import { useState } from "preact/hooks";
import { useLocation, useRoute } from "wouter-preact";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Receipt,
  UtensilsCrossed,
  LogOut,
  LogIn,
  ChevronLeft,
  ChevronRight,
  Shield,
  Key,
  Warehouse,
  DollarSign,
} from "lucide-react";

const allLinks = [
  { href: "/", label: "Inicio", icon: LayoutDashboard, screen: null as string | null },
  { href: "/pos", label: "POS", icon: ShoppingCart, screen: "pos" },
  { href: "/products", label: "Productos", icon: Package, screen: "products" },
  { href: "/customers", label: "Clientes", icon: Users, screen: "customers" },
  { href: "/sales", label: "Ventas", icon: Receipt, screen: "sales" },
  { href: "/restaurants", label: "Restaurante", icon: UtensilsCrossed, screen: "restaurants" },
  { href: "/purchases", label: "Inventario", icon: Warehouse, screen: "purchases" },
  { href: "/exchange-rate", label: "Tasa BCV", icon: DollarSign, screen: null },
];

interface SidebarProps {
  user: { id: number; email?: string; username: string; is_superuser: number } | null;
  permissions: string[];
  onLogout: () => void;
  onChangePasswordClick: () => void;
}

export function Sidebar({ user, permissions, onLogout, onChangePasswordClick }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar:collapsed") === "1";
    } catch {
      return false;
    }
  });

  function toggleCollapse() {
    try {
      localStorage.setItem("sidebar:collapsed", collapsed ? "0" : "1");
    } catch {}
    setCollapsed((v) => !v);
  }

  const isSuperuser = user?.is_superuser === 1;
  const links = allLinks.filter((l) => !l.screen || isSuperuser || permissions.includes(l.screen));
  const showAdmin = isSuperuser || permissions.includes("users");

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
        className={`fixed md:static inset-y-0 left-0 z-40 bg-zinc-900 text-zinc-100 flex flex-col transition-all duration-200 ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${collapsed ? "w-20" : "w-64"}`}
      >
        <div className="px-5 py-5 border-b border-zinc-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
            P
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold tracking-tight">pos-system</h1>
              <p className="text-[10px] text-zinc-500">Punto de Venta</p>
            </div>
          )}
          <button
            onClick={toggleCollapse}
            className="ml-auto text-zinc-400 hover:text-zinc-100 text-xs px-2 py-1 rounded hidden md:block"
            title={collapsed ? "Expandir" : "Colapsar"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {links.map((link) => {
            const [isActive] = useRoute(link.href === "/" ? "/" : link.href === "/pos" ? "/pos" : link.href);
            return (
              <a
                key={link.href}
                href={link.href}
                title={link.label}
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  navigate(link.href);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors ${
                  isActive
                    ? "bg-indigo-500/20 text-indigo-300 font-medium"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <span className="w-5 text-center flex-shrink-0">
                  {(() => { const Icon = link.icon; return <Icon size={18} />; })()}
                </span>
                {!collapsed && <span className="truncate">{link.label}</span>}
              </a>
            );
          })}

          {showAdmin && (
            <a
              href="/admin"
              title="Usuarios"
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                navigate("/admin");
              }}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors ${
                location.pathname === "/admin"
                  ? "bg-indigo-500/20 text-indigo-300 font-medium"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <span className="w-5 text-center flex-shrink-0">
                <Shield size={18} />
              </span>
              {!collapsed && <span className="truncate">Usuarios</span>}
            </a>
          )}
        </nav>

        <div className="px-4 py-3 border-t border-zinc-800 space-y-2">
          {user && !collapsed && (
            <p className="text-xs text-zinc-500 truncate">{user.email}</p>
          )}
          {user ? (
            <>
              <button
                onClick={onChangePasswordClick}
                className="w-full py-2 text-xs text-zinc-400 hover:text-violet-400 transition-colors flex items-center gap-2"
              >
                <Key size={14} />
                {!collapsed && "Cambiar Contraseña"}
              </button>
              <button
                onClick={onLogout}
                className="w-full py-2 text-xs text-zinc-400 hover:text-red-400 transition-colors flex items-center gap-2"
              >
                <LogOut size={14} />
                {!collapsed && "Cerrar Sesión"}
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="w-full py-2 text-xs text-zinc-400 hover:text-violet-400 transition-colors flex items-center gap-2"
            >
              <LogIn size={14} />
              {!collapsed && "Iniciar Sesión"}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
