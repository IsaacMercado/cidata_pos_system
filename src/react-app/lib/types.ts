export interface Category {
  id: number;
  name: string;
  description: string | null;
  parentId: number | null;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductRate {
  code: string;
  name: string;
  rate: number;
  fetchedAt: string;
}

export interface ReservationRate {
  guests: number;
  price: number;
}

export type ProductType = "simple" | "combo" | "reservation";
export type CatalogStatus = "active" | "needs_review" | "inactive";

export interface Product {
  id: number;
  code: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: number | null;
  price: number;
  cost: number;
  taxRate: number;
  unit: string;
  productType: ProductType;
  catalogStatus: CatalogStatus;
  minStock: number;
  currentStock: number;
  stockProjection: number;
  stockOfficial: number | null;
  isActive: number;
  rates?: ProductRate[];
  reservationRates?: ReservationRate[];
  comboItems?: Array<{ componentProductId: number; quantity: number }>;
  variantGroupId?: number | null;
  variantAttributes?: string[];
  variantValues?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ProductWithCategory extends Product {
  category: Category | null;
}

export interface Customer {
  id: number;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  documentType: string;
  documentNumber: string | null;
  isActive: number;
  creditLimit: number;
  currentBalance: number;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethodCode = "cash" | "card" | "transfer" | "mobile";
export type SaleStatus = "in_progress" | "completed" | "cancelled" | "refunded";

// ─── Per-line discounts ──────────────────────────────────────────────────────
// A product line can carry one or more discounts applied sequentially. Each
// discount is either a fixed amount (in the currency shown at the TPV) or a
// percentage of the running subtotal.
export type DiscountType = "fixed" | "percent";

export interface LineDiscount {
  id: string;
  type: DiscountType;
  value: number;
  label?: string;
}

export function newDiscountId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `disc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface SalePayment {
  id: number;
  saleId: number;
  paymentMethodId: number;
  amount: number;
  amountUsd?: number;
  amountOriginal?: number;
  exchangeRate?: number;
  currency?: string;
  reference: string | null;
  paymentDate?: string | null;
  phone?: string | null;
  createdAt: string;
}

export interface Sale {
  id: number;
  receiptNumber: string;
  customerId: number | null;
  userId: number | null;
  tableId: number | null;
  tableName: string | null;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  paymentMethodId: number | null;
  status: SaleStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  createdAt: string;
}

export interface SaleWithItems extends Sale {
  items: (SaleItem & { product: Product })[];
  payments: SalePayment[];
  customer: Customer | null;
}

export interface CartItem {
  product: ProductWithCategory;
  quantity: number;
  discounts?: LineDiscount[];
  reservation?: {
    checkIn: string;
    checkOut: string;
    total: number;
    guests: number;
    guestPrice: number;
    guestName?: string;
    guestEmail?: string;
    guestPhone?: string;
  };
}
