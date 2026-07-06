export interface Category {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  category_id: number | null;
  code: string;
  barcode: string | null;
  unit: string;
  tax_rate: number;
  min_stock: number;
  current_stock: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ProductWithCategory extends Product {
  category: Category | null;
}

export interface Customer {
  id: number;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  document_type: string;
  document_number: string | null;
  is_active: number;
  credit_limit: number;
  current_balance: number;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = "cash" | "card" | "transfer" | "mobile";
export type SaleStatus = "completed" | "cancelled" | "refunded";

export interface SalePayment {
  id: number;
  sale_id: number;
  payment_method_id: number;
  amount: number;
  reference: string | null;
  created_at: string;
}

export interface Sale {
  id: number;
  receipt_number: string;
  customer_id: number | null;
  user_id: number | null;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  created_at: string;
}

export interface SaleWithItems extends Sale {
  sale_items: (SaleItem & { product: Product })[];
  sale_payments: SalePayment[];
  customer: Customer | null;
}

export interface CartItem {
  product: ProductWithCategory;
  quantity: number;
}

export interface PaymentEntry {
  method: string;
  amount: number;
}
