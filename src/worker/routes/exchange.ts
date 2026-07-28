import { eq, getTableColumns, sql } from "drizzle-orm";
import { Hono } from "hono";
import { exchangeRates } from "../db/schema";
import type { Env } from "../index";

const app = new Hono<Env>();

app.get("/", async (c) => {
  const db = c.get("db");
  const rates = await db
    .select()
    .from(exchangeRates);
  return c.json({ data: rates });
});

app.get("/current", async (c) => {
  const db = c.get("db");

  const subquery = db
    .select({
      ...getTableColumns(exchangeRates),
      rowNum: sql<number>`ROW_NUMBER() OVER (
            PARTITION BY ${exchangeRates.currencyFrom}, ${exchangeRates.currencyTo}
            ORDER BY ${exchangeRates.fetchedAt} DESC
          )`.as("row_num"),
    })
    .from(exchangeRates)
    .as("sub");

  const ratesDb = await db
    .select()
    .from(subquery)
    .where(eq(subquery.rowNum, 1));

  return c.json(Object.fromEntries(ratesDb.map((record) => [record.currencyFrom, record.rate])));
});

app.post("/", async (c) => {
  const db = c.get("db");
  const body = await c.req.json<{ currencyFrom: string; currencyTo: string; rate: number }>();

  await db.insert(exchangeRates).values({
    currencyFrom: body.currencyFrom,
    currencyTo: body.currencyTo,
    rate: body.rate,
  }).run();

  return c.json({ success: true });
});

export default app;
