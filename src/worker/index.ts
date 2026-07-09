import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb } from "./db";
import productsRouter from "./routes/products";
import salesRouter from "./routes/sales";
import customersRouter from "./routes/customers";
import inventoryRouter from "./routes/inventory";
import restaurantsRouter from "./routes/restaurants";
import purchasesRouter from "./routes/purchases";
import exchangeRouter from "./routes/exchange";
import authRouter from "./routes/auth";

export interface Env {
  Bindings: {
    DB: D1Database;
    ASSETS: Fetcher;
    JWT_SECRET: string;
  };
  Variables: {
    db: ReturnType<typeof createDb>;
    env: Env["Bindings"];
    jwtPayload: Record<string, unknown>;
  };
}

const app = new Hono<Env>();

app.use("*", cors());

app.use("*", async (c, next) => {
  c.set("db", createDb(c.env.DB));
  c.set("env", c.env);
  await next();
});

app.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() }),
);

app.route("/api/products", productsRouter);
app.route("/api/sales", salesRouter);
app.route("/api/customers", customersRouter);
app.route("/api/inventory", inventoryRouter);
app.route("/api/restaurants", restaurantsRouter);
app.route("/api/purchases", purchasesRouter);
app.route("/api/exchange-rate", exchangeRouter);
app.route("/api", authRouter);

app.notFound(async (c) => {
  const url = new URL(c.req.url);
  if (!url.pathname.startsWith("/api/")) {
    return c.env.ASSETS.fetch(new URL("/index.html", c.req.url));
  }
  return c.json({ error: "Not found" }, 404);
});

export default app;
