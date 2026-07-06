import { OdooClient, type OdooConfig } from "./odoo";
import type { Db } from "../db";
import { products, customers, sales, saleItems, inventoryMovements, syncLog } from "../db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

export class SyncService {
  private odoo: OdooClient;
  private running = false;

  constructor(config: OdooConfig) {
    this.odoo = new OdooClient(config);
  }

  private async logSync(
    db: Db,
    entityType: string,
    entityId: number,
    action: string,
    status: string,
    errorMessage?: string,
  ) {
    await db.insert(syncLog).values({
      entityType,
      entityId,
      action,
      status,
      errorMessage,
      syncedAt: status === "synced" ? sql`(datetime('now'))` : null,
    });
  }

  async syncAll(db: Db): Promise<{ synced: number; errors: number }> {
    if (this.running) throw new Error("Sync already in progress");
    this.running = true;

    let synced = 0;
    let errors = 0;

    try {
      await this.odoo.authenticate();

      // 1. Sync products with pending sync status
      const pendingProducts = await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.isActive, 1),
            isNull(products.odooId),
          ),
        )
        .all();

      for (const p of pendingProducts) {
        try {
          const odooId = await this.odoo.syncProduct({
            code: p.code,
            name: p.name,
            price: p.price,
            cost: p.cost,
            barcode: p.barcode ?? undefined,
            taxRate: p.taxRate,
          });

          await db
            .update(products)
            .set({ odooId, updatedAt: sql`(datetime('now'))` })
            .where(eq(products.id, p.id));

          await this.logSync(db, "product", p.id, "create", "synced");
          synced++;
        } catch (e) {
          errors++;
          await this.logSync(
            db,
            "product",
            p.id,
            "create",
            "error",
            (e as Error).message,
          );
        }
      }

      // 2. Sync pending customers
      const pendingCustomers = await db
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.isActive, 1),
            isNull(customers.odooId),
          ),
        )
        .all();

      for (const c of pendingCustomers) {
        try {
          const odooId = await this.odoo.syncCustomer({
            code: c.code,
            name: c.name,
            email: c.email ?? undefined,
            phone: c.phone ?? undefined,
            documentNumber: c.documentNumber ?? undefined,
          });

          await db
            .update(customers)
            .set({ odooId, updatedAt: sql`(datetime('now'))` })
            .where(eq(customers.id, c.id));

          await this.logSync(db, "customer", c.id, "create", "synced");
          synced++;
        } catch (e) {
          errors++;
          await this.logSync(
            db,
            "customer",
            c.id,
            "create",
            "error",
            (e as Error).message,
          );
        }
      }

      // 3. Sync pending sales
      const pendingSales = await db
        .select()
        .from(sales)
        .where(
          and(
            eq(sales.status, "completed"),
            eq(sales.syncStatus, "pending"),
          ),
        )
        .all();

      for (const s of pendingSales) {
        try {
          const items = await db
            .select()
            .from(saleItems)
            .where(eq(saleItems.saleId, s.id))
            .all();

          const customerRecord = s.customerId
            ? await db
                .select({ odooId: customers.odooId })
                .from(customers)
                .where(eq(customers.id, s.customerId))
                .get()
            : null;

          const odooId = await this.odoo.syncSale({
            receiptNumber: s.receiptNumber,
            customerOdooId: customerRecord?.odooId ?? undefined,
            total: s.total,
            items: items.map((i) => ({
              productOdooId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              total: i.total,
            })),
          });

          await db
            .update(sales)
            .set({
              odooId,
              syncStatus: "synced",
              updatedAt: sql`(datetime('now'))`,
            })
            .where(eq(sales.id, s.id));

          await this.logSync(db, "sale", s.id, "create", "synced");
          synced++;
        } catch (e) {
          errors++;
          await this.logSync(
            db,
            "sale",
            s.id,
            "create",
            "error",
            (e as Error).message,
          );
        }
      }

      // 4. Sync pending inventory movements
      const pendingMovements = await db
        .select()
        .from(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.syncStatus, "pending"),
            isNull(inventoryMovements.odooId),
          ),
        )
        .all();

      for (const m of pendingMovements) {
        try {
          const odooId = await this.odoo.create("stock.move", {
            product_id: m.productId,
            product_uom_qty: Math.abs(m.quantity),
            location_id: m.type === "exit" ? 8 : 7,
            location_dest_id: m.type === "exit" ? 7 : 8,
            reference: m.notes || `POS ${m.referenceType} #${m.referenceId}`,
          });

          await db
            .update(inventoryMovements)
            .set({
              odooId,
              syncStatus: "synced",
            })
            .where(eq(inventoryMovements.id, m.id));

          synced++;
        } catch (e) {
          errors++;
          await this.logSync(
            db,
            "inventory_movement",
            m.id,
            "create",
            "error",
            (e as Error).message,
          );
        }
      }

      return { synced, errors };
    } finally {
      this.running = false;
    }
  }

  async pullProducts(db: Db): Promise<number> {
    await this.odoo.authenticate();

    const odooProducts = await this.odoo.searchRead<{
      id: number;
      default_code: string;
      name: string;
      list_price: number;
      standard_price: number;
      barcode: string | null;
    }>(
      "product.template",
      [["sale_ok", "=", true]],
      ["id", "default_code", "name", "list_price", "standard_price", "barcode"],
    );

    let imported = 0;
    for (const p of odooProducts) {
      if (!p.default_code) continue;

      const existing = await db
        .select()
        .from(products)
        .where(eq(products.code, p.default_code))
        .get();

      if (existing) {
        await db
          .update(products)
          .set({
            name: p.name,
            price: p.list_price,
            cost: p.standard_price,
            barcode: p.barcode,
            odooId: p.id,
            updatedAt: sql`(datetime('now'))`,
          })
          .where(eq(products.id, existing.id));
      } else {
        await db.insert(products).values({
          code: p.default_code,
          name: p.name,
          price: p.list_price,
          cost: p.standard_price,
          barcode: p.barcode,
          odooId: p.id,
        });
      }
      imported++;
    }

    return imported;
  }

  async pullCustomers(db: Db): Promise<number> {
    await this.odoo.authenticate();

    const partners = await this.odoo.searchRead<{
      id: number;
      ref: string;
      name: string;
      email: string | null;
      phone: string | null;
      vat: string | null;
    }>(
      "res.partner",
      [["customer_rank", ">", 0]],
      ["id", "ref", "name", "email", "phone", "vat"],
    );

    let imported = 0;
    for (const p of partners) {
      const code = p.ref || `ODOO-${p.id}`;
      const existing = await db
        .select()
        .from(customers)
        .where(eq(customers.code, code))
        .get();

      if (existing) {
        await db
          .update(customers)
          .set({
            name: p.name,
            email: p.email,
            phone: p.phone,
            documentNumber: p.vat,
            odooId: p.id,
            updatedAt: sql`(datetime('now'))`,
          })
          .where(eq(customers.id, existing.id));
      } else {
        await db.insert(customers).values({
          code,
          name: p.name,
          email: p.email,
          phone: p.phone,
          documentNumber: p.vat,
          odooId: p.id,
        });
      }
      imported++;
    }

    return imported;
  }
}
