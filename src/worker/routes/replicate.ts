import { and, desc, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { ZodError } from "zod";
import {
  categories,
  comboItems,
  exchangeRates,
  paymentMethods,
  products,
  reservationRates,
  reservations,
  restaurantTables,
  restaurants,
  saleItems,
  salePayments,
  sales,
  sequences,
  users,
} from "../db/schema";
import type { Env } from "../index";
import { enqueueSaleOutboxStatement } from "../lib/integration";
import { computeSaleItemValues, reservationTotal, salePushSchema, validatePaymentDetails } from "../lib/sales-contract";

async function getCurrentRate(
  db: any,
  currencyFrom: string,
  currencyTo: string,
): Promise<number | null> {
  if (currencyFrom === currencyTo) return 1;
  const row = await db
    .select({ rate: exchangeRates.rate })
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.currencyFrom, currencyFrom),
        eq(exchangeRates.currencyTo, currencyTo),
      ),
    )
    .orderBy(desc(exchangeRates.fetchedAt))
    .limit(1)
    .get();
  return row?.rate ?? null;
}

async function generateReceiptNumber(
  db: any,
): Promise<string> {
  const date = new Date();
  const prefix = `REC-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  await db
    .insert(sequences)
    .values({ name: "receipt_number", value: 1 })
    .onConflictDoNothing()
    .run();
  const seq = await db
    .update(sequences)
    .set({ value: sql`value + 1` })
    .where(eq(sequences.name, "receipt_number"))
    .returning({ value: sequences.value })
    .get();
  return `${prefix}-${String(seq!.value).padStart(5, "0")}`;
}

const app = new Hono<Env>();

// Pull-only replication: the client replicates reference data from the server.
// Writes still go through the existing REST API (so D1 triggers keep working).
type CollectionConfig = {
  query: (
    db: Env["Variables"]["db"],
    cpUpdated: string,
    cpId: number,
    limit: number,
  ) => Promise<any[]>;
  transform: (row: any) => any;
};

const orderByUpdated = (table: string) =>
  sql`${sql.raw(`${table}.updated_at`)} ASC, ${sql.raw(`${table}.id`)} ASC`;
const whereUpdated = (table: string, cpUpdated: string, cpId: number) =>
  sql`(${sql.raw(`${table}.updated_at`)} > ${cpUpdated}) OR (${sql.raw(`${table}.updated_at`)} = ${cpUpdated} AND ${sql.raw(`${table}.id`)} > ${cpId})`;

const COLLECTIONS: Record<string, CollectionConfig> = {
  products: {
    query: async (db, cpUpdated, cpId, limit) => {
      const rows = await db
        .select()
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(whereUpdated("products", cpUpdated, cpId))
        .orderBy(orderByUpdated("products"))
        .limit(limit)
        .all();

      const latestRateRows = await db
        .select({
          currencyTo: exchangeRates.currencyTo,
          rate: exchangeRates.rate,
          fetchedAt: exchangeRates.fetchedAt,
        })
        .from(exchangeRates)
        .where(eq(exchangeRates.currencyFrom, "USD"))
        .orderBy(desc(exchangeRates.fetchedAt))
        .all();

      const rateMap = new Map<string, { rate: number; fetchedAt: string }>();
      for (const r of latestRateRows) {
        if (!rateMap.has(r.currencyTo)) {
          rateMap.set(r.currencyTo, { rate: r.rate, fetchedAt: r.fetchedAt });
        }
      }

      // Fetch all combo_items for product enrichment
      const allComboItems = await db
        .select({
          comboProductId: comboItems.comboProductId,
          componentProductId: comboItems.componentProductId,
          quantity: comboItems.quantity,
        })
        .from(comboItems)
        .all();

      const allReservationRates = await db
        .select({
          productId: reservationRates.productId,
          guests: reservationRates.guests,
          price: reservationRates.price,
        })
        .from(reservationRates)
        .all();

      const reservationRatesByProduct = new Map<
        number,
        Array<{ guests: number; price: number }>
      >();
      for (const rate of allReservationRates) {
        const list = reservationRatesByProduct.get(rate.productId) ?? [];
        list.push({ guests: rate.guests, price: rate.price });
        reservationRatesByProduct.set(rate.productId, list);
      }

      const comboByProduct = new Map<
        number,
        Array<{ componentProductId: number; quantity: number }>
      >();

      for (const ci of allComboItems) {
        const list = comboByProduct.get(ci.comboProductId) ?? [];
        list.push({
          componentProductId: ci.componentProductId,
          quantity: ci.quantity,
        });
        comboByProduct.set(ci.comboProductId, list);
      }

      return rows.map((row) => ({
        ...row,
        _rates: Array.from(rateMap.entries()).map(([code, data]) => ({
          code,
          name: code,
          rate: +(data.rate * row.products.price).toFixed(2),
          fetchedAt: data.fetchedAt,
        })),
        _comboItems: comboByProduct.get(row.products.id) ?? [],
        _reservationRates: reservationRatesByProduct.get(row.products.id) ?? [],
      }));
    },
    transform: (row) => ({
      rxid: String(row.products.id),
      id: row.products.id,
      externalId: row.products.externalId,
      templateExternalId: row.products.templateExternalId,
      variantExternalId: row.products.variantExternalId,
      attributeValues: row.products.attributeValues ?? {},
      taxExternalId: row.products.taxExternalId,
      catalogVersion: row.products.catalogVersion,
      code: row.products.code,
      barcode: row.products.barcode,
      name: row.products.name,
      description: row.products.description,
      categoryId: row.products.categoryId,
      categoryName: row.categories?.name ?? null,
      price: row.products.price,
      cost: row.products.cost,
      taxRate: row.products.taxRate,
      unit: row.products.unit,
      productType: row.products.productType,
      catalogStatus: row.products.catalogStatus,
      minStock: row.products.minStock,
      currentStock: row.products.currentStock,
      stockProjection: row.products.stockProjection,
      isActive: row.products.isActive,
      createdAt: row.products.createdAt,
      updatedAt: row.products.updatedAt,
      variantGroupId: row.products.variantGroupId,
      variantAttributes: row.products.variantAttributes ?? [],
      variantValues: row.products.variantValues ?? {},
      rates: row._rates ?? [],
      reservationRates: row._reservationRates ?? [],
      comboItems: row._comboItems ?? [],
      _deleted: false,
    }),
  },

  restaurants: {
    query: (db, cpUpdated, cpId, limit) =>
      db
        .select()
        .from(restaurants)
        .where(whereUpdated("restaurants", cpUpdated, cpId))
        .orderBy(orderByUpdated("restaurants"))
        .limit(limit),
    transform: (row) => ({ ...row, rxid: String(row.id), _deleted: false }),
  },

  restaurant_tables: {
    query: (db, cpUpdated, cpId, limit) =>
      db
        .select()
        .from(restaurantTables)
        .where(whereUpdated("restaurant_tables", cpUpdated, cpId))
        .orderBy(orderByUpdated("restaurant_tables"))
        .limit(limit),
    transform: (row) => ({ ...row, rxid: String(row.id), _deleted: false }),
  },

  operators: {
    query: (db, cpUpdated, cpId, limit) =>
      db
        .select({
          id: users.id,
          username: users.username,
          name: users.name,
          role: users.role,
          isSuperuser: users.isSuperuser,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(whereUpdated("users", cpUpdated, cpId))
        .orderBy(orderByUpdated("users"))
        .limit(limit),
    transform: (row) => ({ ...row, rxid: String(row.id), _deleted: false }),
  },
};

app.post("/:collection/pull", async (c) => {
  const collection = c.req.param("collection");
  const cfg = COLLECTIONS[collection];
  if (!cfg) return c.json({ error: "Unknown collection" }, 400);

  const db = c.get("db");
  const { checkpoint, limit = 100 } = await c.req.json<{
    checkpoint: { updatedAt: string; id: number } | null;
    limit?: number;
  }>();

  const cpUpdated = checkpoint?.updatedAt ?? "";
  const cpId = checkpoint?.id ?? 0;

  const rows = await cfg.query(db, cpUpdated, cpId, limit);
  const documents = rows.map(cfg.transform);

  const last = documents[documents.length - 1];
  const newCheckpoint = last
    ? { updatedAt: last.updatedAt, id: last.id }
    : null;

  return c.json({ documents, checkpoint: newCheckpoint });
});

app.post("/:collection/push", async (c) => {
  const collection = c.req.param("collection");
  if (collection !== "sales")
    return c.json({ error: "Unknown collection" }, 400);

  const db = c.get("db");
  let body: import("../lib/sales-contract").SalePushInput;
  try {
    body = salePushSchema.parse(await c.req.json());
  } catch (error) {
    const details = error instanceof ZodError
      ? error.issues.map((issue) => ({ path: issue.path, message: issue.message, code: issue.code }))
      : String(error);
    return c.json({ error: "Invalid sale payload", details }, 400);
  }
  if (!validatePaymentDetails(body.payments)) {
    return c.json({ error: "Transferencia requiere referencia y fecha; pago móvil requiere también teléfono" }, 400);
  }

  try {
    // Idempotent retry: if this offline document was already pushed, return
    // the existing sale instead of inserting a duplicate.
    if (body.clientId) {
      const existingRows = await db
        .select({
          id: sales.id,
          receiptNumber: sales.receiptNumber,
        })
        .from(sales)
        .where(eq(sales.clientId, body.clientId))
        .limit(1)
        .all();
      const existing = existingRows[0];
      if (existing && body.status === "in_progress") {
        const productRows = await db
          .select({ id: products.id, taxRate: products.taxRate, isActive: products.isActive, catalogStatus: products.catalogStatus })
          .from(products)
          .where(inArray(products.id, body.items.map((item) => item.productId)))
          .all();
        if (productRows.length !== new Set(body.items.map((item) => item.productId)).size || productRows.some((product) => !product.isActive || product.catalogStatus !== "active")) {
          return c.json({ error: "La venta contiene un producto inexistente, pendiente de revisión o inactivo" }, 400);
        }
        const taxRateMap = new Map(productRows.map((product) => [product.id, product.taxRate ?? 0]));
        const itemValues = body.items.map((item) => {
          const computed = computeSaleItemValues(existing.id, item, taxRateMap.get(item.productId) ?? 0);
          return {
            saleId: existing.id,
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
        });
        const subtotal = itemValues.reduce((sum, item) => sum + item.subtotal, 0);
        const taxTotal = itemValues.reduce((sum, item) => sum + item.taxAmount, 0);
        const discountTotal = itemValues.reduce((sum, item) => sum + item.discountAmount, 0);
        await db.batch([
          db.delete(saleItems).where(eq(saleItems.saleId, existing.id)),
          db.insert(saleItems).values(itemValues),
          db.update(sales).set({
            subtotal,
            taxTotal,
            discountTotal,
            total: subtotal + taxTotal,
            tableId: body.tableId ?? undefined,
            notes: body.notes ?? undefined,
          }).where(eq(sales.id, existing.id)),
        ]);
        return c.json({ success: true, serverId: existing.id, receiptNumber: existing.receiptNumber });
      }
      if (existing && body.status === "completed") {
        const existingSale = await db.select({ id: sales.id, total: sales.total, status: sales.status }).from(sales).where(eq(sales.id, existing.id)).get();
        if (existingSale?.status === "completed") return c.json({ success: true, serverId: existing.id, receiptNumber: existing.receiptNumber });
        const usdRate = await getCurrentRate(db, "USD", "VES");
        if (body.payments.some((payment) => payment.currency === "VES") && !usdRate) return c.json({ error: "No hay tasa USD→VES configurada" }, 400);
        const paymentValues = body.payments.map((payment) => {
          const hasOriginal = payment.amountOriginal != null;
          const amountUsd = hasOriginal || payment.currency !== "VES"
            ? Math.round(payment.amount * 100) / 100
            : Math.round((payment.amount / (usdRate ?? 1)) * 100) / 100;
          return {
            saleId: existing.id,
            paymentMethodId: payment.paymentMethodId,
            amount: amountUsd,
            currency: payment.currency ?? "USD",
            amountOriginal: payment.amountOriginal ?? null,
            exchangeRate: payment.currency === "VES" ? (payment.exchangeRate ?? usdRate) : 1,
            reference: payment.reference ?? null,
            paymentDate: payment.paymentDate ?? null,
            phone: payment.phone ?? null,
            amountUsd,
          };
        });
        if (Math.abs(paymentValues.reduce((sum, payment) => sum + payment.amountUsd, 0) - Number(existingSale?.total ?? 0)) > 0.01) return c.json({ error: "La suma de pagos no coincide con el total de la venta" }, 400);
        await db.batch([
          db.delete(salePayments).where(eq(salePayments.saleId, existing.id)),
          db.insert(salePayments).values(paymentValues),
          db.update(sales).set({ status: "completed" }).where(eq(sales.id, existing.id)),
          enqueueSaleOutboxStatement(db, { id: existing.id, clientId: body.clientId ?? null, receiptNumber: existing.receiptNumber }, "completed"),
        ]);
        return c.json({ success: true, serverId: existing.id, receiptNumber: existing.receiptNumber });
      }
    }

    const reservationsToInsert = body.reservations ?? [];
    const usdRate = await getCurrentRate(db, "USD", "VES");

    if (body.payments.some((payment) => payment.currency === "VES") && !usdRate) {
      return c.json({ error: "No hay tasa USD→VES configurada" }, 400);
    }

    // Fetch all product tax rates in one query
    const productIds = body.items.map((i) => i.productId);
    const productRows = await db
      .select({ id: products.id, taxRate: products.taxRate, productType: products.productType, isActive: products.isActive, catalogStatus: products.catalogStatus })
      .from(products)
      .where(inArray(products.id, productIds))
      .all();
    const taxRateMap = new Map<number, number>();
    for (const p of productRows) {
      taxRateMap.set(p.id, p.taxRate ?? 0);
    }
    if (productRows.length !== new Set(productIds).size) {
      return c.json({ error: "La venta contiene productos inexistentes" }, 400);
    }
    if (productRows.some((product) => !product.isActive || product.catalogStatus !== "active")) {
      return c.json({ error: "La venta contiene un producto pendiente de revisión o inactivo" }, 400);
    }
    for (const reservation of reservationsToInsert) {
      const product = productRows.find((row) => row.id === reservation.productId);
      if (!product || product.productType !== "reservation") {
        return c.json({ error: "La reservación debe referirse a un producto de tipo reservation" }, 400);
      }
      const expectedTotal = reservationTotal(reservation);
      if (Math.abs(expectedTotal - reservation.total) > 0.01) {
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
    for (let i = 0; i < reservationsToInsert.length; i++) {
      for (let j = i + 1; j < reservationsToInsert.length; j++) {
        const a = reservationsToInsert[i];
        const b = reservationsToInsert[j];
        if (a.productId === b.productId && a.checkIn < b.checkOut && a.checkOut > b.checkIn) {
          return c.json({ error: "La venta contiene reservaciones solapadas para el mismo producto" }, 409);
        }
      }
    }
    const methodRows = await db.select({ id: paymentMethods.id, isActive: paymentMethods.isActive }).from(paymentMethods).where(inArray(paymentMethods.id, body.payments.map((payment) => payment.paymentMethodId))).all();
    if (methodRows.length !== new Set(body.payments.map((payment) => payment.paymentMethodId)).size || methodRows.some((method) => !method.isActive)) {
      return c.json({ error: "La venta contiene un método de pago inexistente o inactivo" }, 400);
    }

    const receiptNumber = await generateReceiptNumber(db);
    const saleId = sql`(SELECT id FROM sales WHERE receipt_number = ${receiptNumber})`;
    const itemValues = body.items.map((item) => {
      const computed = computeSaleItemValues(0, item, taxRateMap.get(item.productId) ?? 0);
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
    });
    const paymentValues = body.payments.map((pay) => {
      const hasOriginal = pay.amountOriginal != null;
      const amountUsd = hasOriginal || pay.currency !== "VES"
        ? Math.round(pay.amount * 100) / 100
        : Math.round((pay.amount / (usdRate ?? 1)) * 100) / 100;
      return {
        saleId,
        paymentMethodId: pay.paymentMethodId,
        amount: amountUsd,
        currency: pay.currency ?? "USD",
        amountOriginal: pay.amountOriginal ?? null,
        exchangeRate: pay.currency === "VES" ? (pay.exchangeRate ?? usdRate) : 1,
        reference: pay.reference ?? null,
        paymentDate: pay.paymentDate ?? null,
        phone: pay.phone ?? null,
        amountUsd,
      };
    });
    const calculatedTotal = itemValues.reduce((sum, item) => sum + Number(item.total), 0);
    const calculatedSubtotal = itemValues.reduce((sum, item) => sum + Number(item.subtotal), 0);
    const calculatedTax = itemValues.reduce((sum, item) => sum + Number(item.taxAmount), 0);
    const calculatedDiscount = itemValues.reduce((sum, item) => sum + Number(item.discountAmount), 0);
    const paidTotal = paymentValues.reduce((sum, payment) => sum + payment.amountUsd, 0);
    if (body.status === "completed" && Math.abs(Math.round(calculatedTotal * 100) / 100 - Math.round(paidTotal * 100) / 100) > 0.01) {
      return c.json({ error: "La suma de pagos no coincide con el total de la venta" }, 400);
    }
    const reservationValues = reservationsToInsert.map((reservation) => ({
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
    }));

    const statements = [
      db.insert(sales).values({
        receiptNumber,
        clientId: body.clientId ?? null,
        customerId: body.customerId ?? null,
        userId: body.userId ?? null,
        tableId: body.tableId ?? null,
        subtotal: calculatedSubtotal,
        taxTotal: calculatedTax,
        discountTotal: calculatedDiscount,
        total: calculatedTotal,
        notes: body.notes ?? null,
        status: "in_progress",
      }),
      // Keep each item as its own statement inside the same D1 batch/transaction.
      // A multi-row INSERT can exceed SQLite's bound-variable limit for large sales.
      ...itemValues.map((item) => db.insert(saleItems).values(item)),
      ...(paymentValues.length ? [db.insert(salePayments).values(paymentValues)] : []),
      ...(reservationValues.length ? [db.insert(reservations).values(reservationValues)] : []),
      ...(body.status === "completed" ? [db.update(sales).set({ status: "completed" }).where(eq(sales.clientId, body.clientId))] : []),
      ...(body.status === "completed" ? [enqueueSaleOutboxStatement(db, { id: 0, clientId: body.clientId ?? null, receiptNumber }, "completed")] : []),
    ] as const;
    await db.batch(statements);
    const createdSale = await db.select({ id: sales.id }).from(sales).where(eq(sales.receiptNumber, receiptNumber)).get();
    if (!createdSale) return c.json({ error: "Sale was not created" }, 500);
    return c.json({
      success: true,
      serverId: createdSale.id,
      receiptNumber,
    });
  } catch (error) {
    const caught = error as { message?: unknown };
    const message = caught.message ? String(caught.message) : String(error);
    if (message.includes("UNIQUE constraint failed: sales.client_id") && body.clientId) {
      const existing = await db
        .select({ id: sales.id, receiptNumber: sales.receiptNumber })
        .from(sales)
        .where(eq(sales.clientId, body.clientId))
        .get();
      if (!existing) return c.json({ error: message }, 500);
      const { id, receiptNumber } = existing as { id: number; receiptNumber: string };
      return c.json({ success: true, serverId: id, receiptNumber });
    }
    return c.json({ error: message }, 500);
  }
});

export default app;
