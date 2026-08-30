import { relations, sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// ─── Exchange Rates ──────────────────────────────────────────────────────────
export const exchangeRates = sqliteTable("exchange_rates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  currencyFrom: text("currency_from").notNull().default("USD"),
  currencyTo: text("currency_to").notNull().default("VES"),
  rate: real("rate").notNull().default(0),
  fetchedAt: text("fetched_at").notNull().default(sql`(datetime('now'))`),
});

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
  productType: text("product_type").notNull().default("simple"),
  catalogStatus: text("catalog_status").notNull().default("active"),
  minStock: real("min_stock").notNull().default(0),
  currentStock: real("current_stock").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  variantGroupId: integer("variant_group_id"),
  variantAttributes: text("variant_attributes", { mode: "json" }).notNull().default("[]"),
  variantValues: text("variant_values", { mode: "json" }).notNull().default("{}"),
});

export const variantGroups = sqliteTable("variant_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});
export const variantAttributes = sqliteTable("variant_attributes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => variantGroups.id),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
});
export const productVariants = sqliteTable("product_variants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => variantGroups.id),
  productId: integer("product_id").notNull().unique().references(() => products.id),
  valuesJson: text("values_json", { mode: "json" }).notNull().default("{}"),
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
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Users (POS operators) ───────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  pin: text("pin").notNull().default(""),
  pinHash: text("pin_hash"),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("cashier"),
  isActive: integer("is_active").notNull().default(1),
  isSuperuser: integer("is_superuser").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── User Permissions ─────────────────────────────────────────────────────────
export const userPermissions = sqliteTable("user_permissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  screen: text("screen").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const usersRelations = relations(users, ({ many }) => ({
  userPermissions: many(userPermissions),
}));

export const userPermissionsRelations = relations(userPermissions, ({ one }) => ({
  user: one(users, {
    fields: [userPermissions.userId],
    references: [users.id],
  }),
}));

// ─── Payment Methods ─────────────────────────────────────────────────────────
export const paymentMethods = sqliteTable("payment_methods", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Sales (headers) ─────────────────────────────────────────────────────────
export const sales = sqliteTable(
  "sales",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: text("client_id"),
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
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    clientIdIdx: uniqueIndex("sales_client_id_idx").on(table.clientId),
  }),
);

// ─── Sale Items (lines) ──────────────────────────────────────────────────────
export const saleItems = sqliteTable("sale_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  saleId: integer("sale_id").notNull().references(() => sales.id),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: real("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull().default(0),
  discountPercent: real("discount_percent").notNull().default(0),
  discountAmount: real("discount_amount").notNull().default(0),
  discounts: text("discounts", { mode: "json" }).notNull().default("[]"),
  subtotal: real("subtotal").notNull().default(0),
  taxAmount: real("tax_amount").notNull().default(0),
  total: real("total").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// Frozen component quantities used to reverse combo sales safely.
export const saleItemComponents = sqliteTable("sale_item_components", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  saleItemId: integer("sale_item_id").notNull().references(() => saleItems.id),
  componentProductId: integer("component_product_id").notNull().references(() => products.id),
  quantity: real("quantity").notNull(),
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
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Recipes / theoretical consumption ───────────────────────────────────────
export const recipes = sqliteTable("recipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id),
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const recipeItems = sqliteTable("recipe_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recipeId: integer("recipe_id").notNull().references(() => recipes.id),
  componentProductId: integer("component_product_id").notNull().references(() => products.id),
  quantity: real("quantity").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Purchase Orders ─────────────────────────────────────────────────────────
export const purchaseOrders = sqliteTable("purchase_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  receiptNumber: text("receipt_number").notNull().unique(),
  userId: integer("user_id").references(() => users.id),
  notes: text("notes"),
  status: text("status").notNull().default("completed"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const purchaseOrderItems = sqliteTable("purchase_order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  purchaseOrderId: integer("purchase_order_id").notNull().references(() => purchaseOrders.id),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: real("quantity").notNull().default(0),
  unitCost: real("unit_cost").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const purchaseOrdersRelations = relations(purchaseOrders, ({ many }) => ({
  items: many(purchaseOrderItems),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  product: one(products, {
    fields: [purchaseOrderItems.productId],
    references: [products.id],
  }),
}));

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
  paymentDate: text("payment_date"),
  phone: text("phone"),
  currency: text("currency").notNull().default("USD"),
  amountOriginal: real("amount_original"),
  exchangeRate: real("exchange_rate"),
  amountUsd: real("amount_usd").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Integration Queue (POS Cloudflare -> Odoo) ─────────────────────────────
export const integrationOperations = sqliteTable(
  "integration_operations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    operationId: text("operation_id").notNull(),
    installationId: text("installation_id"),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    payload: text("payload").notNull(),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    errorClass: text("error_class"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
    processingStartedAt: text("processing_started_at"),
    leaseToken: text("lease_token"),
    leaseUntil: text("lease_until"),
    nextAttemptAt: text("next_attempt_at"),
    processedAt: text("processed_at"),
  },
  (table) => ({
    operationIdIdx: uniqueIndex("integration_operations_operation_id_idx").on(table.operationId),
  }),
);

// ─── Catalog change log (Odoo -> POS, Fase 4) ───────────────────────────────
export const catalogChangeLog = sqliteTable("catalog_change_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  changeId: text("change_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityRef: text("entity_ref").notNull(),
  action: text("action").notNull(),
  payload: text("payload").notNull(),
  appliedAt: text("applied_at"),
  result: text("result"),
  publishedAt: text("published_at").notNull().default(sql`(datetime('now'))`),
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

// ─── Combo Items ────────────────────────────────────────────────────────────
export const comboItems = sqliteTable("combo_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  comboProductId: integer("combo_product_id").notNull().references(() => products.id),
  componentProductId: integer("component_product_id").notNull().references(() => products.id),
  quantity: real("quantity").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Reservation Rates ─────────────────────────────────────────────────────
export const reservationRates = sqliteTable("reservation_rates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id),
  guests: integer("guests").notNull().default(1),
  price: real("price").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Reservations ──────────────────────────────────────────────────────────
export const reservations = sqliteTable("reservations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id),
  saleItemId: integer("sale_item_id").references(() => saleItems.id),
  checkIn: text("check_in").notNull(),
  checkOut: text("check_out").notNull(),
  guests: integer("guests").notNull().default(1),
  guestPrice: real("guest_price").notNull().default(0),
  total: real("total").notNull().default(0),
  status: text("status").notNull().default("pending"),
  guestName: text("guest_name"),
  guestEmail: text("guest_email"),
  guestPhone: text("guest_phone"),
  customerId: integer("customer_id").references(() => customers.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  cancelledAt: text("cancelled_at"),
});

// Logical per-product guard used by the reservation overlap trigger.
export const reservationGuards = sqliteTable("reservation_guards", {
  productId: integer("product_id").primaryKey().references(() => products.id),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Relations ───────────────────────────────────────────────────────────────
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  comboItems: many(comboItems),
  reservationRates: many(reservationRates),
}));

export const comboItemsRelations = relations(comboItems, ({ one }) => ({
  comboProduct: one(products, {
    fields: [comboItems.comboProductId],
    references: [products.id],
  }),
  componentProduct: one(products, {
    fields: [comboItems.componentProductId],
    references: [products.id],
  }),
}));

export const reservationRatesRelations = relations(reservationRates, ({ one }) => ({
  product: one(products, {
    fields: [reservationRates.productId],
    references: [products.id],
  }),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  product: one(products, {
    fields: [reservations.productId],
    references: [products.id],
  }),
  saleItem: one(saleItems, {
    fields: [reservations.saleItemId],
    references: [saleItems.id],
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

export const saleItemComponentsRelations = relations(saleItemComponents, ({ one }) => ({
  saleItem: one(saleItems, {
    fields: [saleItemComponents.saleItemId],
    references: [saleItems.id],
  }),
  componentProduct: one(products, {
    fields: [saleItemComponents.componentProductId],
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
