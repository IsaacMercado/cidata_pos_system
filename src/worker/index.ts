import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb } from "./db";
import { middlewareJwtPayload, requireScreenPermission } from "./lib/auth";
import authRouter from "./routes/auth";
import comboItemsRouter from "./routes/combo-items";
import customersRouter from "./routes/customers";
import exchangeRouter from "./routes/exchange";
import integrationRouter from "./routes/integration";
import inventoryRouter from "./routes/inventory";
import productsRouter from "./routes/products";
import purchasesRouter from "./routes/purchases";
import reconcileRouter from "./routes/reconcile";
import replicateRouter from "./routes/replicate";
import reservationRatesRouter from "./routes/reservation-rates";
import reservationsRouter from "./routes/reservations";
import restaurantsRouter from "./routes/restaurants";
import salesRouter from "./routes/sales";
import { updateRatesFromBcv } from "./routes/exchange";

export interface Env {
  Bindings: {
    DB: D1Database;
    ASSETS: Fetcher;
    JWT_SECRET: string;
    INTEGRATION_TOKEN: string;
  };
  Variables: {
    db: ReturnType<typeof createDb>;
    env: Env["Bindings"];
    jwtPayload: Record<string, unknown>;
    integrationAuth?: { kind: "static" | "jwt"; sub?: unknown };
  };
}

const app = new Hono<Env>();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:8787",
  "http://localhost:3000",
  "https://*.pages.dev",
  "https://*.workers.dev",
];

const nativeAppSchemes = ["capacitor", "ionic", "file"];

function isAllowedOrigin(origin: string): boolean {
  return allowedOrigins.some((o) =>
    o === origin || (o.includes("*") && origin.match(new RegExp("^" + o.replace(".", "\\.").replace("*", ".*") + "$")))
  );
}

app.use("*", cors({
  origin: (origin, c) => {
    if (!origin) return "*";

    try {
      const url = new URL(origin);
      const scheme = url.protocol.replace(":", "");

      if (nativeAppSchemes.includes(scheme)) {
        return origin;
      }

      if (scheme === "http" || scheme === "https") {
        return isAllowedOrigin(origin) ? origin : null;
      }

      return null;
    } catch {
      return null;
    }
  },
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  exposeHeaders: ["Content-Length"],
  maxAge: 86400,
  credentials: true,
}));

app.use("*", async (c, next) => {
  c.set("db", createDb(c.env.DB));
  c.set("env", c.env);
  await next();
});

// Auth global: protege todo /api/* excepto los endpoints de login (públicos)
// y los de integración (usan su propio token de servicio).
app.use("/api/*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (path === "/api/login" || path === "/api/login/pin") {
    return next();
  }
  if (path.startsWith("/api/integration/")) {
    return next();
  }
  return middlewareJwtPayload(c, next);
});

// Authorization is enforced here as well as in the UI. Hiding a navigation
// item must never be the only protection for a business operation.
app.use("/api/products", requireScreenPermission("products"));
app.use("/api/products/*", requireScreenPermission("products"));
app.use("/api/combo-items", requireScreenPermission("products"));
app.use("/api/combo-items/*", requireScreenPermission("products"));
app.use("/api/reservation-rates", requireScreenPermission("products"));
app.use("/api/reservation-rates/*", requireScreenPermission("products"));
app.use("/api/reservations", requireScreenPermission("sales"));
app.use("/api/reservations/*", requireScreenPermission("sales"));
app.use("/api/sales", requireScreenPermission("sales"));
app.use("/api/sales/*", requireScreenPermission("sales"));
app.use("/api/customers", requireScreenPermission("customers"));
app.use("/api/customers/*", requireScreenPermission("customers"));
app.use("/api/inventory", requireScreenPermission("purchases"));
app.use("/api/inventory/*", requireScreenPermission("purchases"));
app.use("/api/restaurants", requireScreenPermission("restaurants"));
app.use("/api/restaurants/*", requireScreenPermission("restaurants"));
app.use("/api/purchases", requireScreenPermission("purchases"));
app.use("/api/purchases/*", requireScreenPermission("purchases"));
app.use("/api/reconcile", requireScreenPermission("sales"));
app.use("/api/reconcile/*", requireScreenPermission("sales"));
app.use("/api/exchange-rate", requireScreenPermission("exchange"));
app.use("/api/exchange-rate/*", requireScreenPermission("exchange"));
app.use("/api/replicate/*", requireScreenPermission("pos"));

app.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() }),
);

app.route("/api/products", productsRouter);
app.route("/api/combo-items", comboItemsRouter);
app.route("/api/reservation-rates", reservationRatesRouter);
app.route("/api/reservations", reservationsRouter);
app.route("/api/sales", salesRouter);
app.route("/api/customers", customersRouter);
app.route("/api/inventory", inventoryRouter);
app.route("/api/restaurants", restaurantsRouter);
app.route("/api/purchases", purchasesRouter);
app.route("/api/exchange-rate", exchangeRouter);
app.route("/api/reconcile", reconcileRouter);
app.route("/api", authRouter);
app.route("/api/replicate", replicateRouter);
app.route("/api/integration", integrationRouter);

app.notFound(async (c) => {
  const url = new URL(c.req.url);
  if (!url.pathname.startsWith("/api/")) {
    return c.env.ASSETS.fetch(new URL("/index.html", c.req.url));
  }
  return c.json({ error: "Not found" }, 404);
});

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env["Bindings"]) {
    await updateRatesFromBcv(env);
  },
};
