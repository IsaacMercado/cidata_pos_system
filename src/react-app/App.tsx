import { useEffect, useState } from "preact/hooks";
import { Route, Switch, useLocation } from "wouter-preact";
import { LoginPage, type LoginResult } from "./pages/LoginPage";
import { WelcomePage } from "./pages/WelcomePage";
import { ChangePasswordModal } from "./components/ChangePasswordModal";
import { OfflineBanner } from "./components/OfflineBanner";
import { Sidebar } from "./components/pos/Sidebar";
import { ToastProvider } from "./components/pos/Toast";
import { Loading } from "./components/ui";
import { api } from "./lib/api";
import { syncPendingOps, cacheOperators, type CachedOperator } from "./lib/db";
import { loadSession, saveSession, clearSession } from "./lib/session";
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

function normalizeUser(u: any): UserInfo {
  return { ...u, is_superuser: u.isSuperuser ?? u.is_superuser ?? 0 };
}

// Fallback permissions when offline and not cached: superuser gets everything,
// cashier keeps operating screens so the shift can continue.
function offlinePermissions(u: UserInfo): string[] {
  return u.is_superuser ? [...ALL_SCREENS, "users"] : ["pos", "customers", "sales"];
}

export function App() {
  const online = useOnlineStatus();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [, navigate] = useLocation();

  const refreshOperatorsCache = async () => {
    try {
      const users = await api.auth.list();
      const ops: CachedOperator[] = users.map((u: any) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        isSuperuser: u.isSuperuser ?? u.is_superuser ?? 0,
        pinHash: u.pinHash ?? "",
      }));
      await cacheOperators(ops);
    } catch {}
  };

  useEffect(() => {
    const session = loadSession();
    if (session) {
      setUser(session.user);
      setPermissions(
        session.permissions?.length ? session.permissions : offlinePermissions(session.user),
      );
      setRestoring(false);
      if (online) refreshOperatorsCache().catch(() => {});
      return;
    }

    if (!online) {
      setRestoring(false);
      return;
    }

    api.auth
      .me()
      .then((u: any) => {
        if (u) {
          const normalized = normalizeUser(u);
          setUser(normalized);
          loadPermissions(normalized);
        }
      })
      .catch(() => {})
      .finally(() => setRestoring(false));
  }, []);

  useEffect(() => {
    if (!restoring && !user) {
      navigate("/login");
    }
  }, [restoring, user]);

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
      await refreshOperatorsCache();
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
