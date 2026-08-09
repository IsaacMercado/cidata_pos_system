import { desc, eq, getTableColumns, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { exchangeRates, products } from "../db/schema";
import type { Env } from "../index";
import { createDb } from "../db";

const app = new Hono<Env>();

const rateSchema = z.object({
  currencyFrom: z.string().length(3).transform((value) => value.toUpperCase()),
  currencyTo: z.string().length(3).transform((value) => value.toUpperCase()),
  rate: z.number().finite().positive(),
});

const BCV_URL = "https://www.bcv.org.ve/";

export function parseBcvRates(html: string): Record<string, number> {
  const rates: Record<string, number> = {};
  const blocks: Record<string, string> = { dolar: "USD", euro: "EUR" };

  for (const [id, currency] of Object.entries(blocks)) {
    const match = html.match(new RegExp(`id=["']${id}["'][^>]*>[\\s\\S]*?<strong[^>]*>\\s*([\\d.,]+)\\s*</strong>`, "i"));
    if (!match?.[1]) continue;
    const raw = match[1];
    const value = raw.includes(",")
      ? Number(raw.replace(/\./g, "").replace(",", "."))
      : Number(raw);
    if (Number.isFinite(value) && value > 0) rates[currency] = value;
  }
  return rates;
}

export async function scrapeBcvRates(url = BCV_URL): Promise<Record<string, number>> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`BCV respondió HTTP ${response.status}`);
  const rates = parseBcvRates(await response.text());
  if (Object.keys(rates).length === 0) throw new Error("No se encontraron tasas en la página del BCV");
  return rates;
}

app.get("/", async (c) => {
  const db = c.get("db");
  const rates = await db
    .select()
    .from(exchangeRates)
    .orderBy(desc(exchangeRates.fetchedAt));
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
  const parsed = rateSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Tasa inválida", details: parsed.error.issues }, 400);
  const body = parsed.data;

  await db.insert(exchangeRates).values({
    currencyFrom: body.currencyFrom,
    currencyTo: body.currencyTo,
    rate: body.rate,
  }).run();

  // When a rate changes, the cached `rates` field on every product in RxDB becomes
  // stale (replicate.ts embeds the latest rate into each product document). "Touch"
  // all products so their updated_at bumps and the incremental replication re-pushes
  // the full product list to clients with the new rate baked in. The
  // trg_products_after_update trigger refreshes updated_at automatically.
  if (body.currencyFrom === "USD" || body.currencyFrom === "EUR") {
    await db
      .update(products)
      .set({ updatedAt: sql`datetime('now')` })
      .run();
  }

  return c.json({ success: true });
});

app.get("/scrape", async (c) => {
  try {
    const rates = await scrapeBcvRates(c.req.query("url") || BCV_URL);
    return c.json({ source: "BCV", fetchedAt: new Date().toISOString(), rates });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 502);
  }
});

app.post("/scrape", async (c) => {
  try {
    const rates = await scrapeBcvRates(c.req.query("url") || BCV_URL);
    const db = c.get("db");
    for (const [currencyFrom, rate] of Object.entries(rates)) {
      await db.insert(exchangeRates).values({ currencyFrom, currencyTo: "VES", rate }).run();
    }
    await db.update(products).set({ updatedAt: sql`datetime('now')` }).run();
    return c.json({ success: true, source: "BCV", rates });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 502);
  }
});

export async function updateRatesFromBcv(env: Env["Bindings"]) {
  const rates = await scrapeBcvRates();
  const db = createDb(env.DB);
  for (const [currencyFrom, rate] of Object.entries(rates)) {
    await db.insert(exchangeRates).values({ currencyFrom, currencyTo: "VES", rate }).run();
  }
  await db.update(products).set({ updatedAt: sql`datetime('now')` }).run();
  return rates;
}

export default app;
