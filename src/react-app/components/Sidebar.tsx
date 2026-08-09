import { useState, useEffect } from "preact/hooks";
import { useLocation } from "wouter-preact";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Receipt,
  UtensilsCrossed,
  LogOut,
  Menu,
  X,
  KeyRound,
  Shield,
  Warehouse,
  DollarSign,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import { useAuth } from "../components/Auth";

const allLinks = [
  { href: "/", label: "Inicio", icon: LayoutDashboard, screen: null as string | null },
  { href: "/pos", label: "POS", icon: ShoppingCart, screen: "pos" },
  { href: "/products", label: "Productos", icon: Package, screen: "products" },
  { href: "/customers", label: "Clientes", icon: Users, screen: "customers" },
  { href: "/sales", label: "Ventas", icon: Receipt, screen: "sales" },
  { href: "/restaurants", label: "Restaurante", icon: UtensilsCrossed, screen: "restaurants" },
  { href: "/purchases", label: "Inventario", icon: Warehouse, screen: "purchases" },
  { href: "/exchange-rate", label: "Tasa de cambio", icon: DollarSign, screen: "exchange" },
];

interface SidebarProps {
  onChangePasswordClick: () => void;
}

export function Sidebar({ onChangePasswordClick }: SidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem("pos_sidebar_collapsed") === "true");
  const { user, permissions, handleLogout } = useAuth();
  const [location, navigate] = useLocation();

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("darkMode");
      if (stored !== null) return stored === "true";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  if (!user) return null;

  const isSuperuser = user.isSuperuser === 1;
  const perms = permissions ?? [];
  const links = allLinks.filter((l) => !l.screen || isSuperuser || perms.includes(l.screen));
  const showAdmin = isSuperuser || perms.includes("users");

  function isActive(href: string) {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  }

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || "U";
  const userName = user?.name || "Usuario";
  const userRole = user?.role === "admin" ? "Administrador" : user?.role === "cashier" ? "Cajero" : user?.role || "Recepción";

  function toggleCollapsed() {
    setIsCollapsed((current) => {
      const next = !current;
      localStorage.setItem("pos_sidebar_collapsed", String(next));
      return next;
    });
  }

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 text-white flex items-center justify-between px-4 z-40 shadow-md">
        <div className="flex items-center space-x-3">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-slate-800 focus:outline-none">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center space-x-2">
             <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center font-bold">P</div>
             <span className="font-bold text-lg tracking-tight">POS</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg hover:bg-slate-800"
            title={darkMode ? "Modo claro" : "Modo oscuro"}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>

      {/* Sidebar Overlay (Móvil) */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Navegación) */}
      <div className={`
         fixed inset-y-0 left-0 z-50 bg-slate-900 text-slate-300 flex flex-col transition-[width,transform] duration-300 ease-in-out
         md:relative md:translate-x-0
         ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
         w-64 ${isCollapsed ? 'md:w-16' : 'md:w-64'}
       `}>
        <div className={`h-16 flex items-center bg-slate-950/50 border-b border-slate-800 shrink-0 ${isCollapsed ? 'justify-center px-2' : 'px-6'}`}>
           <div className={`w-8 h-8 bg-indigo-500 rounded flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 ${isCollapsed ? 'mr-0' : 'mr-3'}`}>
            P
          </div>
          <span className={`font-bold text-white text-lg tracking-tight ${isCollapsed ? 'md:hidden' : ''}`}>POS</span>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden ml-auto p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className={`md:flex hidden p-1 text-slate-400 hover:text-white ${isCollapsed ? 'md:hidden' : 'ml-auto'}`}
            title={darkMode ? "Modo claro" : "Modo oscuro"}
          >
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button type="button" onClick={toggleCollapsed} className={`hidden md:block p-1 text-slate-400 hover:text-white ${isCollapsed ? '' : 'ml-2'}`} title={isCollapsed ? "Mostrar barra de navegación" : "Ocultar barra de navegación"} aria-label={isCollapsed ? "Mostrar barra de navegación" : "Ocultar barra de navegación"}>
            {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
           <div className={`px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider ${isCollapsed ? 'md:hidden' : ''}`}>
            Principal
          </div>
          {links.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate(item.href);
              }}
               className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors group ${isCollapsed ? 'md:justify-center md:px-2' : ''} ${
                isActive(item.href)
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
               <item.icon className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? 'mr-0' : 'mr-3'} ${isActive(item.href) ? 'text-indigo-200' : 'text-slate-400 group-hover:text-slate-300'}`} />
               <span className={isCollapsed ? 'md:hidden' : ''}>{item.label}</span>
            </button>
          ))}
          {showAdmin && (
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate("/admin");
              }}
             className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors group ${isCollapsed ? 'md:justify-center md:px-2' : ''} ${
                isActive("/admin")
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
               <Shield className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? 'mr-0' : 'mr-3'} ${isActive("/admin") ? 'text-indigo-200' : 'text-slate-400 group-hover:text-slate-300'}`} />
               <span className={isCollapsed ? 'md:hidden' : ''}>Usuarios</span>
            </button>
          )}
        </nav>

         <div className={`p-4 border-t border-slate-800 shrink-0 ${isCollapsed ? 'md:p-2' : ''}`}>
           <div className={`flex items-center space-x-3 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 ${isCollapsed ? 'md:justify-center md:px-1' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white">
              {userInitial}
            </div>
             <div className={`flex-1 min-w-0 ${isCollapsed ? 'md:hidden' : ''}`}>
              <p className="text-sm font-medium text-white truncate">{userName}</p>
              <p className="text-xs text-slate-500 truncate">{userRole}</p>
            </div>
             <button type="button" className={`text-slate-500 hover:text-white shrink-0 ${isCollapsed ? 'md:hidden' : ''}`} onClick={onChangePasswordClick} aria-label="Cambiar contraseña" title="Cambiar contraseña"><KeyRound className="w-4 h-4" /></button>
             <button type="button" className={`text-slate-500 hover:text-white shrink-0 ${isCollapsed ? 'md:hidden' : ''}`} onClick={handleLogout} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut className="w-4 h-4" /></button>
           </div>
        </div>
      </div>
    </>
  );
}
