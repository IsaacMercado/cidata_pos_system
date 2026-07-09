import { eq, sql, getTableColumns } from "drizzle-orm";
import { Hono } from "hono";
import { exchangeRates } from "../db/schema";
import type { Env } from "../index";

const app = new Hono<Env>();

app.get("/", async (c) => {
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

app.post("/scrape", async (c) => {
  const db = c.get("db");

  try {
    const response = await fetch("https://www.bcv.org.ve/");
    const text = await response.text();
    const usdMatch = text.match(/<span>\s*USD\s*<\/span>.*?<strong[^>]*>\s*([\d.,]+)/s);

    if (!usdMatch) {
      return c.json({ success: false, error: "No se pudo parsear la tasa del BCV" }, 502);
    }

    const usd = parseFloat(usdMatch[1].replace(",", "."));
    if (!usd || usd <= 0) {
      return c.json({ success: false, error: "Tasa inválida" }, 502);
    }

    await db.insert(exchangeRates).values({
      currencyFrom: "USD",
      currencyTo: "VES",
      rate: usd,
    }).run();

    return c.json({ success: true, rate: usd });
  } catch (error) {
    return c.json({ success: false, error: "Error al conectar con el BCV" }, 502);
  }
});

export default app;