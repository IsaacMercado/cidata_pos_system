const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body.data as T;
}

export const api = {
  // Products
  products: {
    list: (params?: { search?: string; categoryId?: number }) =>
      request<any[]>(`/products${params ? "?" + new URLSearchParams(params as any).toString() : ""}`),

    get: (id: number) => request<any>(`/products/${id}`),

    create: (data: any) =>
      request<any>("/products", { method: "POST", body: JSON.stringify(data) }),

    update: (id: number, data: any) =>
      request<any>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

    deactivate: (id: number) =>
      request<any>(`/products/${id}`, { method: "DELETE" }),
  },

  // Customers
  customers: {
    list: (params?: { search?: string }) =>
      request<any[]>(`/customers${params ? "?" + new URLSearchParams(params).toString() : ""}`),

    create: (data: any) =>
      request<any>("/customers", { method: "POST", body: JSON.stringify(data) }),

    update: (id: number, data: any) =>
      request<any>(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  },

  // Sales
  sales: {
    list: (params?: { status?: string; tableId?: number; limit?: number; offset?: number }) =>
      request<any[]>(`/sales${params ? "?" + new URLSearchParams(params as any).toString() : ""}`),

    get: (id: number) => request<any>(`/sales/${id}`),

    create: (data: { items: any[]; customerId?: number; paymentMethodId?: number; notes?: string; tableId?: number; status?: string }) =>
      request<any>("/sales", { method: "POST", body: JSON.stringify(data) }),

    addItems: (id: number, data: { items: any[] }) =>
      request<any>(`/sales/${id}/items`, { method: "POST", body: JSON.stringify(data) }),

    pay: (id: number, data: { payments: { paymentMethodId: number; amount: number; reference?: string }[]; customerId?: number; notes?: string }) =>
      request<any>(`/sales/${id}/pay`, { method: "POST", body: JSON.stringify(data) }),

    cancel: (id: number) =>
      request<any>(`/sales/${id}/cancel`, { method: "POST" }),
  },

  // Inventory
  inventory: {
    stock: (lowStock?: boolean) =>
      request<any[]>(`/inventory/stock${lowStock ? "?lowStock=true" : ""}`),

    adjust: (data: { productId: number; quantity: number; notes?: string }) =>
      request<any>("/inventory/adjust", { method: "POST", body: JSON.stringify(data) }),
  },

  // Restaurants
  restaurants: {
    list: () => request<any[]>("/restaurants"),

    get: (id: number) => request<any>(`/restaurants/${id}`),

    create: (data: { name: string; description?: string }) =>
      request<any>("/restaurants", { method: "POST", body: JSON.stringify(data) }),

    update: (id: number, data: any) =>
      request<any>(`/restaurants/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

    deactivate: (id: number) =>
      request<any>(`/restaurants/${id}`, { method: "DELETE" }),

    // Tables
    addTable: (restaurantId: number, data: any) =>
      request<any>(`/restaurants/${restaurantId}/tables`, { method: "POST", body: JSON.stringify(data) }),

    updateTable: (restaurantId: number, tableId: number, data: any) =>
      request<any>(`/restaurants/${restaurantId}/tables/${tableId}`, { method: "PATCH", body: JSON.stringify(data) }),

    removeTable: (restaurantId: number, tableId: number) =>
      request<any>(`/restaurants/${restaurantId}/tables/${tableId}`, { method: "DELETE" }),
  },

  // Sync
  sync: {
    start: () => request<any>("/sync/start", { method: "POST" }),
    pullProducts: () => request<any>("/sync/pull/products", { method: "POST" }),
    pullCustomers: () => request<any>("/sync/pull/customers", { method: "POST" }),
    log: () => request<any[]>("/sync/log"),
  },
};
