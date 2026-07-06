import type {
  Product,
  ProductWithCategory,
  Customer,
  SaleWithItems,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options?: RequestInit,
  unwrapData = true,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options,
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      body.error || body.message || `HTTP ${res.status}`,
      res.status,
    );
  }

  if (unwrapData && body.data !== undefined) return body.data as T;
  return body as T;
}

export const api = {
  products: {
    list: (params?: { search?: string; categoryId?: number }) =>
      request<ProductWithCategory[]>(
        `/products${params ? "?" + new URLSearchParams(params as any).toString() : ""}`,
      ),

    get: (id: number) => request<ProductWithCategory>(`/products/${id}`),

    create: (data: Partial<Product>) =>
      request<Product>("/products", { method: "POST", body: JSON.stringify(data) }),

    update: (id: number, data: Partial<Product>) =>
      request<Product>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

    deactivate: (id: number) =>
      request<{ success: boolean }>(`/products/${id}`, { method: "DELETE" }),
  },

  customers: {
    list: (params?: { search?: string }) =>
      request<Customer[]>(
        `/customers${params ? "?" + new URLSearchParams(params).toString() : ""}`,
      ),

    create: (data: Partial<Customer>) =>
      request<Customer>("/customers", { method: "POST", body: JSON.stringify(data) }),

    update: (id: number, data: Partial<Customer>) =>
      request<Customer>(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  },

  sales: {
    list: (params?: { status?: string; tableId?: number; limit?: number; offset?: number }) =>
      request<SaleWithItems[]>(
        `/sales${params ? "?" + new URLSearchParams(params as any).toString() : ""}`,
      ),

    get: (id: number) => request<SaleWithItems>(`/sales/${id}`),

    create: (data: {
      items: { productId: number; quantity: number; unitPrice: number; discountPercent: number }[];
      customerId?: number;
      paymentMethodId?: number;
      notes?: string;
      tableId?: number;
      status?: string;
    }) =>
      request<SaleWithItems>("/sales", { method: "POST", body: JSON.stringify(data) }),

    addItems: (id: number, data: { items: any[] }) =>
      request<SaleWithItems>(`/sales/${id}/items`, { method: "POST", body: JSON.stringify(data) }),

    pay: (
      id: number,
      data: {
        payments: { paymentMethodId: number; amount: number; reference?: string }[];
        customerId?: number;
        notes?: string;
      },
    ) => request<SaleWithItems>(`/sales/${id}/pay`, { method: "POST", body: JSON.stringify(data) }),

    cancel: (id: number) =>
      request<{ success: boolean }>(`/sales/${id}/cancel`, { method: "POST" }),
  },

  inventory: {
    stock: (lowStock?: boolean) =>
      request<any[]>(`/inventory/stock${lowStock ? "?lowStock=true" : ""}`),

    adjust: (data: { productId: number; quantity: number; notes?: string }) =>
      request<any>("/inventory/adjust", { method: "POST", body: JSON.stringify(data) }),
  },

  restaurants: {
    list: () => request<any[]>("/restaurants"),

    get: (id: number) => request<any>(`/restaurants/${id}`),

    create: (data: { name: string; description?: string }) =>
      request<any>("/restaurants", { method: "POST", body: JSON.stringify(data) }),

    update: (id: number, data: any) =>
      request<any>(`/restaurants/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

    deactivate: (id: number) =>
      request<any>(`/restaurants/${id}`, { method: "DELETE" }),

    addTable: (restaurantId: number, data: any) =>
      request<any>(`/restaurants/${restaurantId}/tables`, { method: "POST", body: JSON.stringify(data) }),

    updateTable: (restaurantId: number, tableId: number, data: any) =>
      request<any>(`/restaurants/${restaurantId}/tables/${tableId}`, { method: "PATCH", body: JSON.stringify(data) }),

    removeTable: (restaurantId: number, tableId: number) =>
      request<any>(`/restaurants/${restaurantId}/tables/${tableId}`, { method: "DELETE" }),
  },

  auth: {
    login: (data: { email: string; password: string }) =>
      request<{ user: { id: number; email: string; username: string }; token: string; success: boolean }>(
        "/login",
        { method: "POST", body: JSON.stringify(data) },
        false,
      ),

    register: (data: { email: string; username: string; password: string }) =>
      request<{ id: number; email: string; username: string }>(
        "/register",
        { method: "POST", body: JSON.stringify(data) },
        false,
      ),

    me: () =>
      request<{ id: number; email: string; username: string; name: string; role: string } | null>(
        "/users/me",
        undefined,
        false,
      ),

    logout: () =>
      request<{ success: boolean }>("/logout", { method: "POST" }, false),
  },
};
