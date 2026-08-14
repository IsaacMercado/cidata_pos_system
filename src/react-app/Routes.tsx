import { Route, Switch, Redirect } from "wouter-preact";

import { useAuth } from "./components/Auth";
import { AdminPage } from "./pages/AdminPage";
import { CustomersPage } from "./pages/CustomersPage";
import { ExchangeRatePage } from "./pages/ExchangeRatePage";
import { default as HotelPosSystem } from "./pages/HotelPosSystem";
import { LoginPage } from "./pages/LoginPage";
import { PosPage } from "./pages/PosPage";
import { ProductsPage } from "./pages/ProductsPage";
import { PurchaseOrdersPage } from "./pages/PurchaseOrdersPage";
import { ReconcilePage } from "./pages/ReconcilePage";
import { RestaurantsPage } from "./pages/RestaurantsPage";
import { SalesPage } from "./pages/SalesPage";
import { WelcomePage } from "./pages/WelcomePage";

export default function Routes() {
  const { user, permissions, handleLogin } = useAuth();
  const can = (screen: string) => user?.isSuperuser === 1 || permissions.includes(screen);

  return (
    <div className="overflow-y-auto h-full">
      <Switch>
        <Route path="/login">
          <LoginPage onLogin={handleLogin} />
        </Route>
        <Route path="/">
          {user ? <WelcomePage user={user} permissions={permissions} /> : null}
        </Route>
        {user && (
          <>
            <Route path="/pos">{can("pos") ? <PosPage /> : <Redirect to="/" />}</Route>
            <Route path="/products">{can("products") ? <ProductsPage /> : <Redirect to="/" />}</Route>
            <Route path="/customers">{can("customers") ? <CustomersPage /> : <Redirect to="/" />}</Route>
            <Route path="/sales">{can("sales") ? <SalesPage /> : <Redirect to="/" />}</Route>
            <Route path="/restaurants/:view?">{can("restaurants") ? <RestaurantsPage /> : <Redirect to="/" />}</Route>
            <Route path="/admin">{can("users") ? <AdminPage /> : <Redirect to="/" />}</Route>
            <Route path="/purchases">{can("purchases") ? <PurchaseOrdersPage /> : <Redirect to="/" />}</Route>
            <Route path="/exchange-rate">{can("exchange") ? <ExchangeRatePage /> : <Redirect to="/" />}</Route>
            <Route path="/reconcile">{can("sales") ? <ReconcilePage /> : <Redirect to="/" />}</Route>
            <Route path="/hotel-pos" component={HotelPosSystem} />
          </>
        )}
      </Switch>
    </div>
  );
}
