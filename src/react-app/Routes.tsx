import { Route, Switch } from "wouter-preact";

import { useAuth } from "./components/Auth";
import { AdminPage } from "./pages/AdminPage";
import { CustomersPage } from "./pages/CustomersPage";
import { ExchangeRatePage } from "./pages/ExchangeRatePage";
import { default as HotelPosSystem } from "./pages/HotelPosSystem";
import { LoginPage } from "./pages/LoginPage";
import { PosPage } from "./pages/PosPage";
import { ProductsPage } from "./pages/ProductsPage";
import { PurchaseOrdersPage } from "./pages/PurchaseOrdersPage";
import { RestaurantsPage } from "./pages/RestaurantsPage";
import { SalesPage } from "./pages/SalesPage";
import { WelcomePage } from "./pages/WelcomePage";

export default function Routes() {
  const { user, permissions, handleLogin } = useAuth();

  return (
    <div>
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
            <Route path="/hotel-pos" component={HotelPosSystem} />
          </>
        )}
      </Switch>
    </div>
  );
}
