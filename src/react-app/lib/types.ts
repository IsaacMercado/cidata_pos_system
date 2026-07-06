export interface Category {
  id: number;
  name: string;
  description: string | null;
  parentId: number | null;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

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
  minStock: number;
  currentStock: number;
  isActive: number;
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

export interface SalePayment {
  id: number;
  saleId: number;
  paymentMethodId: number;
  amount: number;
  reference: string | null;
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
}
