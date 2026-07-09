import { useEffect, useState } from "preact/hooks";
import { Route, Switch, useLocation } from "wouter-preact";
import { LoginPage } from "./pages/LoginPage";
import { WelcomePage } from "./pages/WelcomePage";
import { ChangePasswordModal } from "./components/ChangePasswordModal";
import { OfflineBanner } from "./components/OfflineBanner";
import { Sidebar } from "./components/pos/Sidebar";
import { ToastProvider } from "./components/pos/Toast";
import { Loading } from "./components/ui";
import { api } from "./lib/api";
import { syncPendingOps } from "./lib/db";
import { useOnlineStatus } from "./lib/useOnlineStatus";
import { CustomersPage } from "./pages/CustomersPage";
import { PosPage } from "./pages/PosPage";
import { ProductsPage } from "./pages/ProductsPage";
import { RestaurantsPage } from "./pages/RestaurantsPage";
import { SalesPage } from "./pages/SalesPage";
import { AdminPage } from "./pages/AdminPage";
import { PurchaseOrdersPage } from "./pages/PurchaseOrdersPage";
import { ExchangeRatePage } from "./pages/ExchangeRatePage";
import "./style.css";

export type UserInfo = {
  id: number;
  email: string;
  username: string;
  name: string;
  role: string;
  is_superuser: number;
};

const ALL_SCREENS = ["pos", "products", "customers", "sales", "restaurants", "purchases"];

export function App() {
  const online = useOnlineStatus();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    api.auth.me().then((u: any) => {
      if (u) {
        const normalized = { ...u, is_superuser: u.isSuperuser ?? u.is_superuser ?? 0 };
        setUser(normalized);
        loadPermissions(normalized);
      }
    }).catch(() => {}).finally(() => setRestoring(false));
  }, []);

  useEffect(() => {
    if (!restoring && !user) {
      navigate("/login");
    }
  }, [restoring, user]);

  const loadPermissions = async (u: UserInfo) => {
    if (u.is_superuser) {
      setPermissions([...ALL_SCREENS, "users"]);
      return;
    }
    try {
      const screens = await api.auth.getPermissions(u.id);
      setPermissions(screens);
    } catch {
      setPermissions([]);
    }
  };

  useEffect(() => {
    if (online) {
      syncPendingOps().catch(() => {});
    }
  }, [online]);

  const handleLogin = async (u: any) => {
    const normalized = { ...u, is_superuser: u.isSuperuser ?? u.is_superuser ?? 0 };
    setUser(normalized);
    await loadPermissions(normalized);
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {}
    setUser(null);
    setPermissions([]);
    navigate("/login");
  };

  if (restoring) return <Loading fullPage text="Restaurando sesión..." />;

  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-col md:flex-row">
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

        <main className={`flex-1 overflow-y-auto ${user ? "pt-14 md:pt-4 pb-20 md:pb-4 px-3 md:px-6" : ""}`}>
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
                <Route path="/restaurants" component={RestaurantsPage} />
                <Route path="/restaurants/:id/:view?" component={RestaurantsPage} />
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
    </ToastProvider>
  );
}
