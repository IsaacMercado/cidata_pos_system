import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  DollarSign,
  LayoutDashboard,
  Package,
  Receipt,
  ShoppingCart,
  Users,
  UtensilsCrossed,
  Warehouse,
} from "lucide-react";
import { useState } from "preact/hooks";

import { ChangePasswordModal } from "./components/ChangePasswordModal";
// import { OfflineBanner } from "./components/OfflineBanner";
import { AuthProvider } from "./components/Auth";
import { ToastProvider } from "./components/pos/Toast";
import { Sidebar } from "./components/Sidebar";
import {
  CommandPaletteProvider,
  CommandRegistration,
  ErrorBoundary,
} from "./components/ui";
import Routes from "./Routes";

import "./style.css";

const queryClient = new QueryClient();
const globalCommands = [
  {
    id: "nav-dashboard",
    label: "Ir al Inicio",
    description: "Navegar al dashboard principal",
    shortcut: "G D",
    icon: <LayoutDashboard size={16} />,
    action: () => (window.location.href = "/"),
    keywords: ["inicio", "dashboard", "home"],
  },
  {
    id: "nav-pos",
    label: "Ir a POS",
    description: "Abrir punto de venta",
    shortcut: "G P",
    icon: <ShoppingCart size={16} />,
    action: () => (window.location.href = "/pos"),
    keywords: ["venta", "punto de venta", "cobrar"],
  },
  {
    id: "nav-products",
    label: "Ir a Productos",
    description: "Gestionar inventario",
    shortcut: "G R",
    icon: <Package size={16} />,
    action: () => (window.location.href = "/products"),
    keywords: ["inventario", "stock", "articulos"],
  },
  {
    id: "nav-customers",
    label: "Ir a Clientes",
    description: "Administrar clientes",
    shortcut: "G C",
    icon: <Users size={16} />,
    action: () => (window.location.href = "/customers"),
    keywords: ["cliente", "clientes"],
  },
  {
    id: "nav-sales",
    label: "Ir a Ventas",
    description: "Ver historial de ventas",
    shortcut: "G V",
    icon: <Receipt size={16} />,
    action: () => (window.location.href = "/sales"),
    keywords: ["historial", "comprobantes"],
  },
  {
    id: "nav-restaurants",
    label: "Ir a Restaurante",
    description: "Gestionar mesas y pedidos",
    shortcut: "G T",
    icon: <UtensilsCrossed size={16} />,
    action: () => (window.location.href = "/restaurants"),
    keywords: ["mesas", "mesero", "comanda"],
  },
  {
    id: "nav-purchases",
    label: "Ir a Inventario",
    description: "Órdenes de compra y recepciones",
    shortcut: "G I",
    icon: <Warehouse size={16} />,
    action: () => (window.location.href = "/purchases"),
    keywords: ["recepcion", "compra", "proveedor"],
  },
  {
    id: "nav-exchange",
    label: "Ir a Tasa BCV",
    description: "Ver y actualizar tasa de cambio",
    shortcut: "G X",
    icon: <DollarSign size={16} />,
    action: () => (window.location.href = "/exchange-rate"),
    keywords: ["tasa", "cambio", "dolar", "bcv"],
  },
  {
    id: "nav-admin",
    label: "Ir a Administración",
    description: "Gestionar usuarios y permisos",
    shortcut: "G A",
    icon: <LayoutDashboard size={16} />,
    action: () => (window.location.href = "/admin"),
    keywords: ["usuarios", "permisos", "admin"],
  },
];

export function App() {
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <CommandPaletteProvider>
        <CommandRegistration commands={globalCommands} />
        <ToastProvider>
          <ErrorBoundary>
            <AuthProvider>
              <div className="flex h-screen w-full bg-slate-100 font-sans text-slate-900 overflow-hidden">
                <Sidebar
                  onChangePasswordClick={() => setPasswordModalOpen(true)}
                />
                <main className="flex-1 flex flex-col min-w-0 pt-16 md:pt-0 h-[100dvh]">
                  <Routes />
                </main>
                <ChangePasswordModal
                  open={passwordModalOpen}
                  onClose={() => setPasswordModalOpen(false)}
                />
              </div>
            </AuthProvider>
          </ErrorBoundary>
        </ToastProvider>
      </CommandPaletteProvider>
    </QueryClientProvider>
  );
}
