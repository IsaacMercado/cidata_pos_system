import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { reservationRates, products } from "../db/schema";
import type { Env } from "../index";
import { validateJson, validationError } from "../lib/zvalidator";

const app = new Hono<Env>();

const schema = z.object({
  productId: z.number(),
  guests: z.number().min(1).default(1),
  price: z.number().min(0).default(0),
});

app.get("/:productId", async (c) => {
  const db = c.get("db");
  const productId = Number(c.req.param("productId"));

  const rates = await db
    .select()
    .from(reservationRates)
    .where(eq(reservationRates.productId, productId))
    .orderBy(reservationRates.guests)
    .all();

  return c.json({ data: rates });
});

app.post("/", async (c) => {
  const db = c.get("db");

  let body: z.infer<typeof schema>;
  try { body = await validateJson(c, schema); }
  catch (e) { return c.json(validationError(e), 400); }

  const product = await db
    .select({ productType: products.productType })
    .from(products)
    .where(eq(products.id, body.productId))
    .get();
  if (!product || product.productType !== "reservation") {
    return c.json({ error: "El producto debe ser de tipo 'reservation'" }, 400);
  }

  const result = await db
    .insert(reservationRates)
    .values(body)
    .returning()
    .get();

  return c.json({ data: result }, 201);
});

app.patch("/:id", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  let body: z.infer<typeof schema>;
  try { body = await validateJson(c, schema); }
  catch (e) { return c.json(validationError(e), 400); }

  const result = await db
    .update(reservationRates)
    .set(body)
    .where(eq(reservationRates.id, id))
    .returning()
    .get();

  if (!result) return c.json({ error: "Not found" }, 404);
  return c.json({ data: result });
});

app.delete("/:id", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  await db.delete(reservationRates).where(eq(reservationRates.id, id)).run();
  return c.json({ success: true });
});

export default app;
