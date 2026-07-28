import {
    QueryClient,
    QueryClientProvider
} from '@tanstack/react-query';
import { DollarSign, LayoutDashboard, Package, Receipt, ShoppingCart, Users, UtensilsCrossed, Warehouse } from "lucide-react";
import { useEffect, useState } from "preact/hooks";

import { Route, Switch, useLocation } from "wouter-preact";
import { ChangePasswordModal } from "./components/ChangePasswordModal";
import { OfflineBanner } from "./components/OfflineBanner";
import { Sidebar } from "./components/pos/Sidebar";
import { ToastProvider } from "./components/pos/Toast";
import { CommandPaletteProvider, CommandRegistration, ErrorBoundary, Loading } from "./components/ui";

import { api } from "./lib/api";
import { syncPendingOps } from "./lib/database";
import { clearSession, loadSession, saveSession } from "./lib/session";
import { useOnlineStatus } from "./lib/useOnlineStatus";

import { AdminPage } from "./pages/AdminPage";
import { CustomersPage } from "./pages/CustomersPage";
import { ExchangeRatePage } from "./pages/ExchangeRatePage";
import { LoginPage, type LoginResult } from "./pages/LoginPage";
import { PosPage } from "./pages/PosPage";
import { ProductsPage } from "./pages/ProductsPage";
import { PurchaseOrdersPage } from "./pages/PurchaseOrdersPage";
import { RestaurantsPage } from "./pages/RestaurantsPage";
import { SalesPage } from "./pages/SalesPage";
import { WelcomePage } from "./pages/WelcomePage";

import "./style.css";

export type UserInfo = {
  id: number;
  email: string;
  username: string;
  name: string;
  role: string;
  is_superuser: number;
};

const queryClient = new QueryClient()

const ALL_SCREENS = ["pos", "products", "customers", "sales", "restaurants", "purchases"];

function normalizeUser(u: any): UserInfo {
  return { ...u, is_superuser: u.isSuperuser ?? u.is_superuser ?? 0 };
}

function offlinePermissions(u: UserInfo): string[] {
  return u.is_superuser ? [...ALL_SCREENS, "users"] : ["pos", "customers", "sales"];
}

const globalCommands = [
  {
    id: "nav-dashboard",
    label: "Ir al Inicio",
    description: "Navegar al dashboard principal",
    shortcut: "G D",
    icon: <LayoutDashboard size={16} />,
    action: () => window.location.href = "/",
    keywords: ["inicio", "dashboard", "home"],
  },
  {
    id: "nav-pos",
    label: "Ir a POS",
    description: "Abrir punto de venta",
    shortcut: "G P",
    icon: <ShoppingCart size={16} />,
    action: () => window.location.href = "/pos",
    keywords: ["venta", "punto de venta", "cobrar"],
  },
  {
    id: "nav-products",
    label: "Ir a Productos",
    description: "Gestionar inventario",
    shortcut: "G R",
    icon: <Package size={16} />,
    action: () => window.location.href = "/products",
    keywords: ["inventario", "stock", "articulos"],
  },
  {
    id: "nav-customers",
    label: "Ir a Clientes",
    description: "Administrar clientes",
    shortcut: "G C",
    icon: <Users size={16} />,
    action: () => window.location.href = "/customers",
    keywords: ["cliente", "clientes"],
  },
  {
    id: "nav-sales",
    label: "Ir a Ventas",
    description: "Ver historial de ventas",
    shortcut: "G V",
    icon: <Receipt size={16} />,
    action: () => window.location.href = "/sales",
    keywords: ["historial", "comprobantes"],
  },
  {
    id: "nav-restaurants",
    label: "Ir a Restaurante",
    description: "Gestionar mesas y pedidos",
    shortcut: "G T",
    icon: <UtensilsCrossed size={16} />,
    action: () => window.location.href = "/restaurants",
    keywords: ["mesas", "mesero", "comanda"],
  },
  {
    id: "nav-purchases",
    label: "Ir a Inventario",
    description: "Órdenes de compra y recepciones",
    shortcut: "G I",
    icon: <Warehouse size={16} />,
    action: () => window.location.href = "/purchases",
    keywords: ["recepcion", "compra", "proveedor"],
  },
  {
    id: "nav-exchange",
    label: "Ir a Tasa BCV",
    description: "Ver y actualizar tasa de cambio",
    shortcut: "G X",
    icon: <DollarSign size={16} />,
    action: () => window.location.href = "/exchange-rate",
    keywords: ["tasa", "cambio", "dolar", "bcv"],
  },
  {
    id: "nav-admin",
    label: "Ir a Administración",
    description: "Gestionar usuarios y permisos",
    shortcut: "G A",
    icon: <LayoutDashboard size={16} />,
    action: () => window.location.href = "/admin",
    keywords: ["usuarios", "permisos", "admin"],
  },
];

export function App() {
  const online = useOnlineStatus();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    const session = loadSession();
    if (session) {
      setUser(session.user);
      setPermissions(
        session.permissions?.length ? session.permissions : offlinePermissions(session.user),
      );
      setRestoring(false);
      return;
    }

    if (!online) {
      setRestoring(false);
      return;
    }

      api.auth
      .me()
      .then(async (u: any) => {
        if (u) {
          const normalized = normalizeUser(u);
          setUser(normalized);
          setPermissions(await loadPermissions(normalized));
        }
      })
      .catch(() => {})
      .finally(() => setRestoring(false));
  }, [online]);

  useEffect(() => {
    if (!restoring && !user) {
      navigate("/login");
    }
  }, [navigate, restoring, user]);

  const loadPermissions = async (u: UserInfo): Promise<string[]> => {
    if (u.is_superuser) return [...ALL_SCREENS, "users"];
    try {
      return await api.auth.getPermissions(u.id);
    } catch {
      return [];
    }
  };

  useEffect(() => {
    if (online) {
      syncPendingOps().catch(() => {});
    }
  }, [online]);

  const handleLogin = async (result: LoginResult) => {
    const normalized = normalizeUser(result.user);
    setUser(normalized);

    let perms: string[];
    if (result.offline) {
      perms = offlinePermissions(normalized);
    } else {
      perms = await loadPermissions(normalized);
    }
    setPermissions(perms);
    saveSession({
      user: normalized,
      token: result.token,
      offline: !!result.offline,
      permissions: perms,
      cachedAt: new Date().toISOString(),
    });
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {}
    clearSession();
    setUser(null);
    setPermissions([]);
    navigate("/login");
  };

  if (restoring) return <Loading fullPage text="Restaurando sesión..." />;

  return (
    <QueryClientProvider client={queryClient}>
      <CommandPaletteProvider>
        <CommandRegistration commands={globalCommands} />
        <ToastProvider>
          <ErrorBoundary>
          <div className="flex min-h-dvh flex-col md:flex-row">
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-lg focus:shadow-lg">
              Saltar al contenido principal
            </a>
            {!online && <OfflineBanner />}

            {user && (
              <>
                <Sidebar
                  user={user}
                  permissions={permissions}
                  onLogout={handleLogout}
                  onChangePasswordClick={() => setPasswordModalOpen(true)}
                />
                <header className="md:hidden fixed right-4 top-3 z-[100] flex items-center gap-3">
                  <span className="text-sm font-bold text-violet-400">
                    {user.username}
                  </span>
                </header>
              </>
            )}

            <main id="main-content" className={`flex-1 ${user ? "pt-14 md:pt-4 pb-4 md:pb-4 px-3 md:px-6" : ""} min-h-0`}>
              <Switch>
                <Route path="/login">
                  <LoginPage onLogin={handleLogin} />
                </Route>
                <Route path="/">
                  {user ? <WelcomePage user={user} permissions={permissions} /> : null}
                </Route>
                {user && (
                  <>
                    <Route path="/pos" component={PosPage} />
                    <Route path="/products" component={ProductsPage} />
                    <Route path="/customers" component={CustomersPage} />
                    <Route path="/sales" component={SalesPage} />
                    <Route path="/restaurants/:view?" component={RestaurantsPage} />
                    <Route path="/admin" component={AdminPage} />
                    <Route path="/purchases" component={PurchaseOrdersPage} />
                    <Route path="/exchange-rate" component={ExchangeRatePage} />
                  </>
                )}
              </Switch>
            </main>

            <ChangePasswordModal
              open={passwordModalOpen}
              onClose={() => setPasswordModalOpen(false)}
            />
          </div>
          </ErrorBoundary>
        </ToastProvider>
      </CommandPaletteProvider>
    </QueryClientProvider>
  );
}
