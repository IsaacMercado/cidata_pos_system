import { useEffect, useState } from "preact/hooks";
import { Route, Switch } from "wouter-preact";
import { LoginModal } from "./components/LoginModal";
import { OfflineBanner } from "./components/OfflineBanner";
import { Sidebar } from "./components/pos/Sidebar";
import { ToastProvider } from "./components/pos/Toast";
import { Button, Loading } from "./components/ui";
import { api } from "./lib/api";
import { syncPendingOps } from "./lib/db";
import { useOnlineStatus } from "./lib/useOnlineStatus";
import { CustomersPage } from "./pages/CustomersPage";
import { PosPage } from "./pages/PosPage";
import { ProductsPage } from "./pages/ProductsPage";
import { RestaurantsPage } from "./pages/RestaurantsPage";
import { SalesPage } from "./pages/SalesPage";
import "./style.css";

export function App() {
  const online = useOnlineStatus();
  const [user, setUser] = useState<{
    id: number;
    email: string;
    username: string;
  } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    api.auth.me().then((u) => {
      if (u) setUser(u);
    }).catch(() => {}).finally(() => setRestoring(false));
  }, []);

  useEffect(() => {
    if (online) {
      syncPendingOps().catch(() => {});
    }
  }, [online]);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {}
    setUser(null);
  };

  if (restoring) return <Loading fullPage text="Restaurando sesión..." />;

  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-col md:flex-row">
        {!online && <OfflineBanner />}
        <Sidebar
          userEmail={user?.email}
          onLoginClick={() => setModalOpen(true)}
          onLogout={handleLogout}
        />

        <header className="md:hidden fixed right-4 top-3 z-[100] flex items-center gap-3">
          {user ? (
            <span className="text-sm font-bold text-violet-400">
              {user.username}
            </span>
          ) : (
            <Button size="sm" onClick={() => setModalOpen(true)}>
              Login / Register
            </Button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto pt-14 md:pt-4 pb-20 md:pb-4 px-3 md:px-6">
          <Switch>
            <Route path="/" component={PosPage} />
            <Route path="/products" component={ProductsPage} />
            <Route path="/customers" component={CustomersPage} />
            <Route path="/sales" component={SalesPage} />
            <Route path="/restaurants" component={RestaurantsPage} />
            <Route path="/restaurants/:id/:view?" component={RestaurantsPage} />
          </Switch>
        </main>

        <LoginModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onLogin={(u) => setUser(u)}
        />
      </div>
    </ToastProvider>
  );
}
