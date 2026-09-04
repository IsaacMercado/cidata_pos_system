import { and, asc, eq, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { products, reservations } from "../db/schema";
import type { Env } from "../index";
import { validateJson, validationError } from "../lib/zvalidator";
import { z } from "zod";

const app = new Hono<Env>();
const statusSchema = z.enum(["pending", "confirmed", "checked_in", "checked_out", "cancelled", "no_show"]);
const createSchema = z.object({
  productId: z.number().int().positive(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().int().positive().default(1),
  guestPrice: z.number().finite().min(0).default(0),
  total: z.number().finite().min(0),
  guestName: z.string().trim().min(1).max(200).optional(),
  guestEmail: z.string().trim().email().max(255).optional(),
  guestPhone: z.string().trim().max(40).optional(),
  customerId: z.number().int().positive().optional(),
  status: statusSchema.default("pending"),
}).superRefine((value, ctx) => {
  if (value.checkOut <= value.checkIn) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["checkOut"], message: "Check-out debe ser posterior" });
  if (Math.abs(value.total - ((Date.parse(`${value.checkOut}T00:00:00Z`) - Date.parse(`${value.checkIn}T00:00:00Z`)) / 86400000) * value.guestPrice) > 0.01) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["total"], message: "Total inválido" });
});

app.get("/availability", async (c) => {
  const productId = Number(c.req.query("productId"));
  const checkIn = c.req.query("checkIn") || "";
  const checkOut = c.req.query("checkOut") || "";
  if (!Number.isInteger(productId) || !checkIn || !checkOut || checkIn >= checkOut) return c.json({ error: "Producto y fechas válidos son requeridos" }, 400);
  const conflicts = await c.get("db").select({ id: reservations.id, checkIn: reservations.checkIn, checkOut: reservations.checkOut })
    .from(reservations).where(and(eq(reservations.productId, productId), ne(reservations.status, "cancelled"), sql`${reservations.checkIn} < ${checkOut}`, sql`${reservations.checkOut} > ${checkIn}`)).all();
  return c.json({ data: { available: conflicts.length === 0, conflicts } });
});

app.get("/", async (c) => {
  const db = c.get("db");
  const status = c.req.query("status");
  const productId = Number(c.req.query("productId"));
  const rows = await db.select({ reservation: reservations, product: { id: products.id, name: products.name, code: products.code } })
    .from(reservations).leftJoin(products, eq(products.id, reservations.productId))
    .where(and(status ? eq(reservations.status, status) : undefined, Number.isInteger(productId) && productId > 0 ? eq(reservations.productId, productId) : undefined))
    .orderBy(asc(reservations.checkIn)).all();
  return c.json({ data: rows.map(({ reservation, product }) => ({ ...reservation, product })) });
});

app.post("/", async (c) => {
  let body: z.infer<typeof createSchema>;
  try { body = await validateJson(c, createSchema); } catch (e) { return c.json(validationError(e), 400); }
  try {
    const product = await c.get("db").select({ id: products.id, productType: products.productType }).from(products).where(eq(products.id, body.productId)).get();
    if (!product || product.productType !== "reservation") return c.json({ error: "El producto no es reservable" }, 400);
    const created = await c.get("db").insert(reservations).values({ productId: body.productId, checkIn: body.checkIn, checkOut: body.checkOut, guests: body.guests, guestPrice: body.guestPrice, total: body.total, guestName: body.guestName, guestEmail: body.guestEmail, guestPhone: body.guestPhone, customerId: body.customerId, status: body.status }).returning().get();
    return c.json({ data: created }, 201);
  } catch (error) { const message = error instanceof Error ? error.message : String(error); if (message.includes("RESERVATION_")) return c.json({ error: message.split(": ").slice(1).join(": ") || message }, 409); throw error; }
});

app.patch("/:id/status", async (c) => {
  const id = Number(c.req.param("id"));
  const parsed = z.object({ status: statusSchema }).safeParse(await c.req.json().catch(() => ({})));
  if (!Number.isInteger(id) || !parsed.success) return c.json({ error: "Estado inválido" }, 400);
  const now = new Date().toISOString();
  const updated = await c.get("db").update(reservations).set({ status: parsed.data.status, updatedAt: now, cancelledAt: parsed.data.status === "cancelled" ? now : null }).where(eq(reservations.id, id)).returning().get();
  if (!updated) return c.json({ error: "Reservación no encontrada" }, 404);
  return c.json({ data: updated });
});

app.post("/:id/cancel", async (c) => {
  const id = Number(c.req.param("id"));
  const now = new Date().toISOString();
  const updated = await c.get("db").update(reservations).set({ status: "cancelled", cancelledAt: now, updatedAt: now }).where(eq(reservations.id, id)).returning().get();
  if (!updated) return c.json({ error: "Reservación no encontrada" }, 404);
  return c.json({ data: updated });
});

export default app;
