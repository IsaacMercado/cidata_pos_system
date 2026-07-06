// ─── Odoo JSON-RPC Client ────────────────────────────────────────────────────
// Uses Odoo's JSON-RPC API (compatible with Odoo 14+).
// For Odoo 19+, refer to the JSON-2 API at /json/2/{model}/{method}
// Docs: https://www.odoo.com/documentation/19.0/developer/reference/external_api.html

export interface OdooConfig {
  url: string;
  db: string;
  username: string;
  password: string;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

export class OdooClient {
  private uid: number | null = null;
  private requestId = 0;

  constructor(private config: OdooConfig) {}

  private async rpc<T = unknown>(
    endpoint: string,
    method: string,
    params: unknown[],
  ): Promise<T> {
    const url = `${this.config.url.replace(/\/+$/, "")}${endpoint}`;
    this.requestId++;

    const body: JsonRpcResponse<T> = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method,
        params,
        id: this.requestId,
      }),
    }).then((r) => r.json());

    if (body.error) {
      throw new Error(
        `Odoo RPC error [${body.error.code}]: ${body.error.message}`,
      );
    }

    return body.result as T;
  }

  async authenticate(): Promise<number> {
    const uid = await this.rpc<number>("/jsonrpc", "call", [
      {},
      "common",
      "login",
      [this.config.db, this.config.username, this.config.password],
    ]);

    if (!uid) {
      throw new Error("Odoo authentication failed");
    }

    this.uid = uid;
    return uid;
  }

  private async call<T>(
    model: string,
    method: string,
    args: unknown[] = [],
    kwargs: Record<string, unknown> = {},
  ): Promise<T> {
    if (!this.uid) await this.authenticate();

    return this.rpc<T>("/jsonrpc", "call", [
      {},
      "object",
      "execute_kw",
      [this.config.db, this.uid, this.config.password, model, method, args, kwargs],
    ]);
  }

  async searchRead<T>(
    model: string,
    domain: unknown[],
    fields: string[],
    limit = 100,
    offset = 0,
  ): Promise<T[]> {
    return this.call<T[]>(model, "search_read", [
      domain,
      { fields, limit, offset, order: "id asc" },
    ]);
  }

  async create(model: string, data: Record<string, unknown>): Promise<number> {
    return this.call<number>(model, "create", [data]);
  }

  async write(
    model: string,
    id: number,
    data: Record<string, unknown>,
  ): Promise<boolean> {
    return this.call<boolean>(model, "write", [[id], data]);
  }

  async searchCount(model: string, domain: unknown[]): Promise<number> {
    return this.call<number>(model, "search_count", [domain]);
  }

  async search(model: string, domain: unknown[]): Promise<number[]> {
    return this.call<number[]>(model, "search", [domain]);
  }

  // ─── POS-specific model mappings ─────────────────────────────────────────

  async syncProduct(product: {
    code: string;
    name: string;
    price: number;
    cost: number;
    barcode?: string;
    taxRate?: number;
  }): Promise<number> {
    const existing = await this.searchRead<{ id: number }>(
      "product.template",
      [["default_code", "=", product.code]],
      ["id"],
      1,
    );

    const productData: Record<string, unknown> = {
      default_code: product.code,
      name: product.name,
      list_price: product.price,
      standard_price: product.cost,
      type: "product",
    };

    if (product.barcode) productData.barcode = product.barcode;

    if (existing.length > 0) {
      await this.write("product.template", existing[0].id, productData);
      return existing[0].id;
    }

    return this.create("product.template", productData);
  }

  async syncCustomer(customer: {
    code: string;
    name: string;
    email?: string;
    phone?: string;
    documentNumber?: string;
  }): Promise<number> {
    const existing = await this.searchRead<{ id: number }>(
      "res.partner",
      [["ref", "=", customer.code]],
      ["id"],
      1,
    );

    const partnerData: Record<string, unknown> = {
      ref: customer.code,
      name: customer.name,
      customer_rank: 1,
    };

    if (customer.email) partnerData.email = customer.email;
    if (customer.phone) partnerData.phone = customer.phone;

    if (existing.length > 0) {
      await this.write("res.partner", existing[0].id, partnerData);
      return existing[0].id;
    }

    return this.create("res.partner", partnerData);
  }

  async syncSale(sale: {
    receiptNumber: string;
    customerOdooId?: number;
    userId?: number;
    total: number;
    items: Array<{
      productOdooId: number;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
  }): Promise<number> {
    const orderData: Record<string, unknown> = {
      name: sale.receiptNumber,
      partner_id: sale.customerOdooId || false,
      date_order: new Date().toISOString(),
      state: "sale",
    };

    const odooId = await this.create("sale.order", orderData);

    for (const item of sale.items) {
      await this.create("sale.order.line", {
        order_id: odooId,
        product_id: item.productOdooId,
        product_uom_qty: item.quantity,
        price_unit: item.unitPrice,
        name: `POS Line - ${sale.receiptNumber}`,
      });
    }

    return odooId;
  }
}
