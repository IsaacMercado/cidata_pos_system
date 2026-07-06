import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";

// ─── Sequences ───────────────────────────────────────────────────────────────
export const sequences = sqliteTable("sequences", {
  name: text("name").primaryKey(),
  value: integer("value").notNull().default(0),
});

// ─── Categories ──────────────────────────────────────────────────────────────
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  parentId: integer("parent_id").references((): any => categories.id),
  isActive: integer("is_active").notNull().default(1),
  odooId: integer("odoo_id"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Products ────────────────────────────────────────────────────────────────
export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  barcode: text("barcode"),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: integer("category_id").references(() => categories.id),
  price: real("price").notNull().default(0),
  cost: real("cost").notNull().default(0),
  taxRate: real("tax_rate").notNull().default(0),
  unit: text("unit").notNull().default("unit"),
  minStock: real("min_stock").notNull().default(0),
  currentStock: real("current_stock").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  odooId: integer("odoo_id"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Customers ───────────────────────────────────────────────────────────────
export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  documentType: text("document_type").notNull().default("CI"),
  documentNumber: text("document_number"),
  isActive: integer("is_active").notNull().default(1),
  creditLimit: real("credit_limit").notNull().default(0),
  currentBalance: real("current_balance").notNull().default(0),
  odooId: integer("odoo_id"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Users (POS operators) ───────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  pin: text("pin").notNull(),
  role: text("role").notNull().default("cashier"),
  isActive: integer("is_active").notNull().default(1),
  odooId: integer("odoo_id"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Payment Methods ─────────────────────────────────────────────────────────
export const paymentMethods = sqliteTable("payment_methods", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  isActive: integer("is_active").notNull().default(1),
  odooId: integer("odoo_id"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Sales (headers) ─────────────────────────────────────────────────────────
export const sales = sqliteTable("sales", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  receiptNumber: text("receipt_number").notNull().unique(),
  customerId: integer("customer_id").references(() => customers.id),
  userId: integer("user_id").references(() => users.id),
  tableId: integer("table_id").references((): any => restaurantTables.id),
  tableName: text("table_name"),
  subtotal: real("subtotal").notNull().default(0),
  taxTotal: real("tax_total").notNull().default(0),
  discountTotal: real("discount_total").notNull().default(0),
  total: real("total").notNull().default(0),
  paymentMethodId: integer("payment_method_id").references(() => paymentMethods.id),
  status: text("status").notNull().default("completed"),
  notes: text("notes"),
  odooId: integer("odoo_id"),
  syncStatus: text("sync_status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Sale Items (lines) ──────────────────────────────────────────────────────
export const saleItems = sqliteTable("sale_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  saleId: integer("sale_id").notNull().references(() => sales.id),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: real("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull().default(0),
  discountPercent: real("discount_percent").notNull().default(0),
  discountAmount: real("discount_amount").notNull().default(0),
  subtotal: real("subtotal").notNull().default(0),
  taxAmount: real("tax_amount").notNull().default(0),
  total: real("total").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Inventory Movements ─────────────────────────────────────────────────────
export const inventoryMovements = sqliteTable("inventory_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id),
  type: text("type").notNull(),
  quantity: real("quantity").notNull(),
  referenceType: text("reference_type"),
  referenceId: integer("reference_id"),
  notes: text("notes"),
  userId: integer("user_id").references(() => users.id),
  odooId: integer("odoo_id"),
  syncStatus: text("sync_status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Sync Log ────────────────────────────────────────────────────────────────
export const syncLog = sqliteTable("sync_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  action: text("action").notNull(),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  odooResponse: text("odoo_response"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  syncedAt: text("synced_at"),
});

// ─── Low Stock Alerts ────────────────────────────────────────────────────────
export const lowStockAlerts = sqliteTable("low_stock_alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id),
  currentStock: real("current_stock").notNull(),
  minStock: real("min_stock").notNull(),
  resolved: integer("resolved").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Sale Payments (split payment support) ──────────────────────────────────
export const salePayments = sqliteTable("sale_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  saleId: integer("sale_id").notNull().references(() => sales.id),
  paymentMethodId: integer("payment_method_id").references(() => paymentMethods.id),
  amount: real("amount").notNull(),
  reference: text("reference"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Restaurants ─────────────────────────────────────────────────────────────
export const restaurants = sqliteTable("restaurants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Restaurant Tables ───────────────────────────────────────────────────────
export const restaurantTables = sqliteTable("restaurant_tables", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurants.id),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull().default(2),
  status: text("status").notNull().default("available"),
  shape: text("shape").notNull().default("circle"),
  posX: real("pos_x").notNull().default(0),
  posY: real("pos_y").notNull().default(0),
  width: real("width").notNull().default(60),
  height: real("height").notNull().default(60),
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Relations ───────────────────────────────────────────────────────────────
export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  customer: one(customers, {
    fields: [sales.customerId],
    references: [customers.id],
  }),
  user: one(users, {
    fields: [sales.userId],
    references: [users.id],
  }),
  paymentMethod: one(paymentMethods, {
    fields: [sales.paymentMethodId],
    references: [paymentMethods.id],
  }),
  table: one(restaurantTables, {
    fields: [sales.tableId],
    references: [restaurantTables.id],
  }),
  items: many(saleItems),
  payments: many(salePayments),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
}));

export const restaurantsRelations = relations(restaurants, ({ many }) => ({
  tables: many(restaurantTables),
}));

export const restaurantTablesRelations = relations(restaurantTables, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [restaurantTables.restaurantId],
    references: [restaurants.id],
  }),
}));
