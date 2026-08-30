import { and, desc, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { exchangeRates, paymentMethods, products, reservations, saleItems, salePayments, sales, sequences } from "../db/schema";
import type { Env } from "../index";
import { validateJson, validationError } from "../lib/zvalidator";
import { enqueueSaleOutboxStatement } from "../lib/integration";
import { reservationSchema, reservationTotal, saleItemSchema, salePaymentSchema, validatePaymentDetails, computeSaleItemValues } from "../lib/sales-contract";

const app = new Hono<Env>();

const PAYMENT_METHOD_MOBILE_ID = 4;
const PAYMENT_METHOD_TRANSFER_ID = 3;

const saleItemInput = saleItemSchema;

const createSaleSchema = z.object({
  customerId: z.number().optional(),
  userId: z.number().optional(),
  paymentMethodId: z.number().optional(),
  notes: z.string().optional(),
  tableId: z.number().optional(),
  status: z.enum(["in_progress", "completed"]).default("in_progress"),
  items: z.array(saleItemInput).min(1),
  reservations: z.array(reservationSchema).optional(),
});

const addItemsSchema = z.object({
  items: z.array(saleItemInput).min(1),
});

const paymentInput = salePaymentSchema;

const paySchema = z.object({
  payments: z.array(paymentInput).min(1),
  customerId: z.number().optional(),
  notes: z.string().optional(),
}).refine(
   (body) => validatePaymentDetails(body.payments),
   { message: "Transferencia requiere reference y paymentDate; pago móvil requiere también phone" },
 );

async function getCurrentRate(db: any, currencyFrom: string, currencyTo: string): Promise<number | null> {
  if (currencyFrom === currencyTo) return 1;
  const row = await db
    .select({ rate: exchangeRates.rate })
    .from(exchangeRates)
    .where(and(eq(exchangeRates.currencyFrom, currencyFrom), eq(exchangeRates.currencyTo, currencyTo)))
    .orderBy(desc(exchangeRates.fetchedAt))
    .limit(1)
    .get();
  return row?.rate ?? null;
}

async function generateReceiptNumber(db: any): Promise<string> {
  const date = new Date();
  const prefix = `REC-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

  await db.insert(sequences).values({ name: "receipt_number", value: 1 }).onConflictDoNothing().run();

  const seq = await db
    .update(sequences)
    .set({ value: sql`value + 1` })
    .where(eq(sequences.name, "receipt_number"))
    .returning({ value: sequences.value })
    .get();

  return `${prefix}-${String(seq!.value).padStart(5, "0")}`;
}

function insertSaleItemValues(
  saleId: number,
  item: z.infer<typeof saleItemInput>,
  taxRate = 0,
) {
  const computed = computeSaleItemValues(saleId, item, taxRate);

  return {
    saleId,
    productId: computed.productId,
    quantity: computed.quantity,
    unitPrice: computed.unitPrice,
    discountPercent: computed.discountPercent,
    discountAmount: computed.discountAmount,
    discounts: computed.discounts,
    subtotal: computed.subtotal,
    taxAmount: computed.taxAmount,
    total: computed.total,
  };
}

async function getSaleDetails(db: Env["Variables"]["db"], id: number) {
  const sale = await db
    .select()
    .from(sales)
    .where(eq(sales.id, id))
    .get();

  if (!sale) return null;

  const items = await db
    .select()
    .from(saleItems)
    .leftJoin(products, eq(products.id, saleItems.productId))
    .where(eq(saleItems.saleId, id))
    .all();

  const payments = await db
    .select()
    .from(salePayments)
    .where(eq(salePayments.saleId, id))
    .all();

  return {
    ...sale,
    items: items.map(({ sale_items, products }) => ({
      ...sale_items,
      name: products?.name ?? null,
      code: products?.code ?? null,
      unit: products?.unit ?? null,
    })),
    payments,
  };
}

function asClientError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("PAYMENT_TOTAL_MISMATCH") ||
    message.includes("PAYMENT_EXCEEDS_TOTAL") ||
    message.includes("PAYMENT_METHOD_INVALID") ||
    message.includes("STOCK_INSUFFICIENT")
  ) {
    return { error: message.split(": ").slice(1).join(": ") || message };
  }
  return null;
}

app.post("/", async (c) => {
  const db = c.get("db");

  let body: z.infer<typeof createSaleSchema>;
  try {
    body = await validateJson(c, createSaleSchema);
  } catch (e) {
    return c.json(validationError(e), 400);
  }

  try {
    if (body.status === "completed") {
      return c.json({ error: "Una venta completada debe registrarse mediante /pay con sus pagos" }, 400);
    }
    const receiptNumber = await generateReceiptNumber(db);
    const productRows = await db
      .select({ id: products.id, taxRate: products.taxRate, productType: products.productType, isActive: products.isActive, catalogStatus: products.catalogStatus })
      .from(products)
      .where(inArray(products.id, body.items.map((item) => item.productId)))
      .all();
      const taxRateMap = new Map(productRows.map((product) => [product.id, product.taxRate]));
    if (productRows.length !== new Set(body.items.map((item) => item.productId)).size) {
      return c.json({ error: "La venta contiene productos inexistentes" }, 400);
    }
    const invalidProduct = productRows.find((product) => !product.isActive || product.catalogStatus !== "active");
    if (invalidProduct) {
      return c.json({ error: "El producto no está habilitado para operar; revise su ficha de catálogo" }, 400);
    }
    const saleId = sql`(SELECT id FROM sales WHERE receipt_number = ${receiptNumber})`;
    const itemValues = body.items.map((item) => ({
      ...insertSaleItemValues(0, item, taxRateMap.get(item.productId) ?? 0),
      saleId,
    }));
    for (const reservation of body.reservations ?? []) {
      const product = productRows.find((row) => row.id === reservation.productId);
      if (!product || product.productType !== "reservation") {
        return c.json({ error: "La reservación debe referirse a un producto de tipo reservation" }, 400);
      }
      if (Math.abs(reservationTotal(reservation) - reservation.total) > 0.01) {
        return c.json({ error: "El total de la reservación no coincide con sus noches y precio" }, 400);
      }
      const overlap = await db
        .select({ id: reservations.id })
        .from(reservations)
        .innerJoin(saleItems, eq(saleItems.id, reservations.saleItemId))
        .innerJoin(sales, eq(sales.id, saleItems.saleId))
        .where(and(
          eq(reservations.productId, reservation.productId),
          lt(reservations.checkIn, reservation.checkOut),
          gt(reservations.checkOut, reservation.checkIn),
          ne(sales.status, "cancelled"),
        ))
        .limit(1)
        .get();
      if (overlap) return c.json({ error: "El producto ya está reservado para esas fechas" }, 409);
    }
    const incomingReservations = body.reservations ?? [];
    for (let i = 0; i < incomingReservations.length; i++) {
      for (let j = i + 1; j < incomingReservations.length; j++) {
        const a = incomingReservations[i];
        const b = incomingReservations[j];
        if (a.productId === b.productId && a.checkIn < b.checkOut && a.checkOut > b.checkIn) {
          return c.json({ error: "La venta contiene reservaciones solapadas para el mismo producto" }, 409);
        }
      }
    }

    await db.batch([
      db.insert(sales).values({
        receiptNumber,
        customerId: body.customerId,
        userId: body.userId,
        tableId: body.tableId,
        subtotal: 0,
        taxTotal: 0,
        discountTotal: 0,
        total: 0,
        paymentMethodId: body.paymentMethodId,
        notes: body.notes,
        status: body.status,
      }),
      db.insert(saleItems).values(itemValues),
      ...(body.reservations?.length ? [db.insert(reservations).values(body.reservations.map((reservation) => ({
        productId: reservation.productId,
        saleItemId: sql`(SELECT id FROM sale_items WHERE sale_id = ${saleId} AND product_id = ${reservation.productId} LIMIT 1)`,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        guests: reservation.guests,
        guestPrice: reservation.guestPrice,
         total: reservation.total,
         status: "pending",
         guestName: reservation.guestName,
         guestEmail: reservation.guestEmail,
         guestPhone: reservation.guestPhone,
         customerId: reservation.customerId,
       })))] : []),
    ]);

    const createdSale = await db.select({ id: sales.id }).from(sales).where(eq(sales.receiptNumber, receiptNumber)).get();
    if (!createdSale) return c.json({ error: "Sale was not created" }, 500);
    const fullSale = await getSaleDetails(db, createdSale.id);
    return c.json({ data: fullSale }, 201);
  } catch (error) {
    const clientError = asClientError(error);
    if (clientError) return c.json({ error: clientError.error }, 400);
    throw error;
  }
});

app.get("/", async (c) => {
  const db = c.get("db");
  const status = c.req.query("status");
  const tableId = c.req.query("tableId");
  const limit = Number(c.req.query("limit") || 50);
  const offset = Number(c.req.query("offset") || 0);

  const conditions = [];
  if (status) conditions.push(eq(sales.status, status));
  if (tableId) conditions.push(eq(sales.tableId, Number(tableId)));

  const result = await db
    .select()
    .from(sales)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sales.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return c.json({ data: result });
});

app.get("/:id", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));
  const sale = await getSaleDetails(db, id);
  if (!sale) return c.json({ error: "Sale not found" }, 404);
  return c.json({ data: sale });
});

app.post("/:id/items", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  const sale = await db
    .select()
    .from(sales)
    .where(eq(sales.id, id))
    .get();

  if (!sale) return c.json({ error: "Sale not found" }, 404);
  if (sale.status !== "in_progress") return c.json({ error: "Only in-progress sales can add items" }, 400);

  let body: z.infer<typeof addItemsSchema>;
  try {
    body = await validateJson(c, addItemsSchema);
  } catch (e) {
    return c.json(validationError(e), 400);
  }

  try {
    const itemValues = body.items.map((item) => insertSaleItemValues(id, item));
    await db.insert(saleItems).values(itemValues).run();
  } catch (error) {
    const clientError = asClientError(error);
    if (clientError) return c.json({ error: clientError.error }, 400);
    throw error;
  }

  const updatedSale = await getSaleDetails(db, id);
  return c.json({ data: updatedSale });
});

app.post("/:id/pay", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  const sale = await db
    .select()
    .from(sales)
    .where(eq(sales.id, id))
    .get();

  if (!sale) return c.json({ error: "Sale not found" }, 404);
  if (sale.status === "completed") return c.json({ error: "Sale already completed" }, 400);
  if (sale.status === "cancelled") return c.json({ error: "Sale is cancelled" }, 400);

  let body: z.infer<typeof paySchema>;
  try {
    body = await validateJson(c, paySchema);
  } catch (e) {
    return c.json(validationError(e), 400);
  }

  const usdRate = await getCurrentRate(db, "USD", "VES");
  if (!usdRate) return c.json({ error: "No hay tasa USD→VES configurada" }, 400);

  const methodRows = await db
    .select({ id: paymentMethods.id, isActive: paymentMethods.isActive })
    .from(paymentMethods)
    .where(inArray(paymentMethods.id, body.payments.map((payment) => payment.paymentMethodId)))
    .all();
  if (methodRows.length !== new Set(body.payments.map((payment) => payment.paymentMethodId)).size || methodRows.some((method) => !method.isActive)) {
    return c.json({ error: "La venta contiene un método de pago inexistente o inactivo" }, 400);
  }

  const paymentValues = await Promise.all(body.payments.map(async (p) => {
    const exchangeRate = p.currency === "VES" ? usdRate : null;
    const amountUsd = p.currency === "VES" ? +(p.amount / usdRate).toFixed(2) : p.amount;
    return {
      saleId: id,
      paymentMethodId: p.paymentMethodId,
      amount: Math.round(amountUsd * 100) / 100,
      amountOriginal: p.amount,
      exchangeRate,
      amountUsd: Math.round(amountUsd * 100) / 100,
      currency: p.currency,
      reference: p.reference || null,
      paymentDate: p.paymentDate || null,
      phone: p.phone || null,
    };
  }));
  const paidTotal = paymentValues.reduce((sum, payment) => sum + payment.amountUsd, 0);
  if (Math.abs(Math.round(paidTotal * 100) / 100 - Math.round(sale.total * 100) / 100) > 0.01) {
    return c.json({ error: "La suma de pagos no coincide con el total de la venta" }, 400);
  }

  try {
    await db.batch([
      db.delete(salePayments).where(eq(salePayments.saleId, id)),
      db.insert(salePayments).values(paymentValues),
      db.update(sales)
        .set({
          status: "completed",
          customerId: body.customerId ?? sale.customerId,
          notes: body.notes ?? sale.notes,
          paymentMethodId: paymentValues.length === 1 ? paymentValues[0].paymentMethodId : null,
        })
        .where(eq(sales.id, id)),
      enqueueSaleOutboxStatement(db, sale, "completed"),
    ]);
  } catch (error) {
    const clientError = asClientError(error);
    if (clientError) return c.json({ error: clientError.error }, 400);
    throw error;
  }

  const fullSale = await getSaleDetails(db, id);
  return c.json({ data: fullSale });
});

app.post("/:id/cancel", async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  const sale = await db
    .select()
    .from(sales)
    .where(eq(sales.id, id))
    .get();

  if (!sale) return c.json({ error: "Sale not found" }, 404);
  if (sale.status === "cancelled") return c.json({ error: "Sale already cancelled" }, 400);

  const result = await db
    .batch([
      db.update(sales).set({ status: "cancelled" }).where(eq(sales.id, id)),
      enqueueSaleOutboxStatement(db, sale, "cancelled"),
    ]);

  const cancelled = await db.select().from(sales).where(eq(sales.id, id)).get();
  return c.json({ data: cancelled });
});

export default app;
