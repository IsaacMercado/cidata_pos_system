import { eq, inArray } from "drizzle-orm";
import { integrationOperations, paymentMethods, saleItems, salePayments, sales, products, reservations, saleItemComponents } from "../db/schema";
import type { Db } from "../db";

export type SaleIntegrationPayload = {
  sale: {
    client_id: string | null;
    receipt_number: string;
    created_at: string;
    updated_at: string;
    user_id: number | null;
    table_id: number | null;
    table_name: string | null;
    subtotal: number;
    tax_total: number;
    discount_total: number;
    total: number;
    notes: string | null;
  };
  items: Array<{
    product_id: number;
    code: string;
    name: string;
    unit: string;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    discount_amount: number;
    discounts: { type: "fixed" | "percent"; value: number; label?: string }[];
    promotion_discounts?: { type: "fixed" | "percent"; value: number; label?: string }[];
    external_id?: string | null;
    catalog_version?: number;
    tax_rate: number;
    tax_amount: number;
    subtotal: number;
    total: number;
    is_combo_component?: boolean;
    bom_components?: Array<{ external_id: string | null; code: string | null; name: string | null; quantity: number; catalog_version: number }>;
  }>;
  payments: Array<{
    method_code: string | null;
    method_name: string | null;
    amount: number;
    amount_original: number | null;
    currency: string;
    exchange_rate: number | null;
    amount_usd: number;
    reference: string | null;
    phone: string | null;
    payment_date: string | null;
  }>;
  reservations?: Array<{
    reservation_id: number;
    client_id: string | null;
    product_code: string;
    product_name: string;
    check_in: string;
    check_out: string;
      guests: number;
      guest_price: number;
      total: number;
      status: string;
      guest_name: string | null;
      guest_email: string | null;
      guest_phone: string | null;
  }>;
};

export function newOperationId(): string {
  return `op_${crypto.randomUUID()}`;
}

export async function buildSalePayload(db: Db, saleId: number): Promise<SaleIntegrationPayload | null> {
  const sale = await db.select().from(sales).where(eq(sales.id, saleId)).get();
  if (!sale) return null;

  const itemRows = await db
    .select({
      saleItemId: saleItems.id,
      productId: saleItems.productId,
      quantity: saleItems.quantity,
      unitPrice: saleItems.unitPrice,
      discountPercent: saleItems.discountPercent,
      discountAmount: saleItems.discountAmount,
      discounts: saleItems.discounts,
      subtotal: saleItems.subtotal,
      taxAmount: saleItems.taxAmount,
      total: saleItems.total,
      code: products.code,
      name: products.name,
      unit: products.unit,
      taxRate: products.taxRate,
      productType: products.productType,
      externalId: products.externalId,
      catalogVersion: products.catalogVersion,
      externalIdSnapshot: saleItems.externalIdSnapshot,
      codeSnapshot: saleItems.codeSnapshot,
      nameSnapshot: saleItems.nameSnapshot,
      unitSnapshot: saleItems.unitSnapshot,
      taxRateSnapshot: saleItems.taxRateSnapshot,
      catalogVersionSnapshot: saleItems.catalogVersionSnapshot,
    })
    .from(saleItems)
    .innerJoin(products, eq(products.id, saleItems.productId))
    .where(eq(saleItems.saleId, saleId))
    .all();

  const comboIds = new Set(itemRows.filter((i) => i.productType === "combo").map((i) => i.productId));
  const componentRows = await db
    .select()
    .from(saleItemComponents)
    .where(inArray(saleItemComponents.saleItemId, itemRows.map((item) => item.saleItemId)))
    .all();
  const paymentRows = await db
    .select({
      amount: salePayments.amount,
      amountOriginal: salePayments.amountOriginal,
      currency: salePayments.currency,
      exchangeRate: salePayments.exchangeRate,
      amountUsd: salePayments.amountUsd,
      reference: salePayments.reference,
      phone: salePayments.phone,
      paymentDate: salePayments.paymentDate,
      methodCode: paymentMethods.code,
      methodName: paymentMethods.name,
    })
    .from(salePayments)
    .leftJoin(paymentMethods, eq(paymentMethods.id, salePayments.paymentMethodId))
    .where(eq(salePayments.saleId, saleId))
    .all();

  const reservationRows = await db
    .select({
      clientSaleId: sales.clientId,
      reservationId: reservations.id,
      checkIn: reservations.checkIn,
      checkOut: reservations.checkOut,
      guests: reservations.guests,
      guestPrice: reservations.guestPrice,
      total: reservations.total,
      status: reservations.status,
      guestName: reservations.guestName,
      guestEmail: reservations.guestEmail,
      guestPhone: reservations.guestPhone,
      productCode: products.code,
      productName: products.name,
    })
    .from(reservations)
    .innerJoin(saleItems, eq(saleItems.id, reservations.saleItemId))
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .innerJoin(products, eq(products.id, reservations.productId))
    .where(eq(sales.id, saleId))
    .all();

  return {
    sale: {
      client_id: sale.clientId,
      receipt_number: sale.receiptNumber,
      created_at: sale.createdAt,
      updated_at: sale.updatedAt,
      user_id: sale.userId,
      table_id: sale.tableId,
      table_name: sale.tableName,
      subtotal: sale.subtotal,
      tax_total: sale.taxTotal,
      discount_total: sale.discountTotal,
      total: sale.total,
      notes: sale.notes,
    },
    items: itemRows.map((item) => ({
      product_id: item.productId,
       code: item.codeSnapshot ?? item.code,
       name: item.nameSnapshot ?? item.name,
       unit: item.unitSnapshot ?? item.unit,
       external_id: item.externalIdSnapshot ?? item.externalId ?? item.code,
       catalog_version: item.catalogVersionSnapshot ?? item.catalogVersion,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount_percent: item.discountPercent,
      discount_amount: item.discountAmount,
       discounts: Array.isArray(item.discounts) ? item.discounts : [],
       promotion_discounts: Array.isArray(item.discounts) ? item.discounts : [],
       tax_rate: item.taxRateSnapshot ?? item.taxRate,
      tax_amount: item.taxAmount,
      subtotal: item.subtotal,
      total: item.total,
       ...(comboIds.has(item.productId) ? { is_combo_component: false, bom_components: componentRows.filter((component) => component.saleItemId === item.saleItemId).map((component) => ({ external_id: component.externalIdSnapshot ?? component.codeSnapshot, code: component.codeSnapshot, name: component.nameSnapshot, quantity: component.quantity, catalog_version: component.catalogVersionSnapshot })) } : {}),
    })),
    payments: paymentRows.map((p) => ({
      method_code: p.methodCode,
      method_name: p.methodName,
      amount: p.amount,
      amount_original: p.amountOriginal,
      currency: p.currency,
      exchange_rate: p.exchangeRate,
      amount_usd: p.amountUsd,
      reference: p.reference,
      phone: p.phone,
      payment_date: p.paymentDate,
    })),
    ...(reservationRows.length > 0
      ? {
          reservations: reservationRows.map((r) => ({
            reservation_id: r.reservationId,
            client_id: r.clientSaleId,
            product_code: r.productCode,
            product_name: r.productName,
            check_in: r.checkIn,
            check_out: r.checkOut,
            guests: r.guests,
            guest_price: r.guestPrice,
            total: r.total,
            status: r.status,
            guest_name: r.guestName,
            guest_email: r.guestEmail,
            guest_phone: r.guestPhone,
          })),
        }
      : {}),
  };
}

export async function enqueueOperation(
  db: Db,
  entityType: string,
  entityId: string,
  payload: unknown,
  operationId = `${entityType}:${entityId}`,
): Promise<string> {
  await db
    .insert(integrationOperations)
    .values({
      operationId,
      entityType,
      entityId,
      payload: JSON.stringify(payload),
      status: "pending",
    })
    .onConflictDoNothing()
    .run();
  return operationId;
}

// Insert this statement in the same D1 batch as the business mutation. The
// payload is materialized when the integration consumer claims the operation.
export function enqueueSaleOutboxStatement(db: Db, sale: { id: number; clientId: string | null; receiptNumber: string }, status: "completed" | "cancelled") {
  const identity = sale.clientId ?? sale.receiptNumber;
  return db.insert(integrationOperations).values({
    operationId: `sale:${identity}:${status}`,
    entityType: status === "completed" ? "sale" : "sale_cancel",
    entityId: identity,
    payload: JSON.stringify(status === "cancelled" ? {
      client_id: sale.clientId,
      receipt_number: sale.receiptNumber,
      cancelled_at: new Date().toISOString(),
    } : {}),
    status: "pending",
  }).onConflictDoNothing();
}

export async function enqueueSale(db: Db, saleId: number): Promise<void> {
  const payload = await buildSalePayload(db, saleId);
  if (!payload) return;
  const identity = payload.sale.client_id ?? payload.sale.receipt_number;
  await enqueueOperation(db, "sale", identity, payload, `sale:${identity}:completed`);
}

export async function enqueueSaleCancellation(
  db: Db,
  saleId: number,
): Promise<void> {
  const sale = await db.select().from(sales).where(eq(sales.id, saleId)).get();
  if (!sale) return;
  const identity = sale.clientId ?? sale.receiptNumber;
  await enqueueOperation(db, "sale_cancel", identity, {
    client_id: sale.clientId,
    receipt_number: sale.receiptNumber,
    cancelled_at: new Date().toISOString(),
  }, `sale:${identity}:cancelled`);
}
