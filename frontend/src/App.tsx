import { Route, Switch } from "wouter-preact";
import { PosPage } from "./pages/PosPage";
import { ProductsPage } from "./pages/ProductsPage";
import { CustomersPage } from "./pages/CustomersPage";
import { SalesPage } from "./pages/SalesPage";
import { RestaurantsPage } from "./pages/RestaurantsPage";
import { SyncPage } from "./pages/SyncPage";
import { Nav } from "./components/Nav";
import { OfflineBanner } from "./components/OfflineBanner";
import { useOnlineStatus } from "./lib/useOnlineStatus";
import "./style.css";

export function App() {
  const online = useOnlineStatus();

  return (
    <div className="flex min-h-dvh flex-col">
      {!online && <OfflineBanner />}
      <main className="flex-1 overflow-y-auto px-3 pt-3 pb-20">
        <Switch>
          <Route path="/" component={PosPage} />
          <Route path="/products" component={ProductsPage} />
          <Route path="/customers" component={CustomersPage} />
          <Route path="/sales" component={SalesPage} />
          <Route path="/restaurants" component={RestaurantsPage} />
          <Route path="/restaurants/:id/:view?" component={RestaurantsPage} />
          <Route path="/sync" component={SyncPage} />
        </Switch>
      </main>
      <Nav />
    </div>
  );
}
