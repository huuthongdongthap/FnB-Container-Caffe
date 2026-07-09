/**
 * ErpnextClient — REST API client for Frappe/ERPNext
 *
 * Handles token-based authentication, CRUD operations, search with filters,
 * retry logic with exponential backoff, and specific ERPNext doctype operations.
 *
 * Auth: Authorization: token {api_key}:{api_secret}
 * CRUD: POST/GET/PUT/DELETE /api/resource/{doctype}
 * Filter: ?filters=[["field","=","value"]]&fields=["f1","f2"]
 *
 * IMPORTANT: modified timestamps must have ".0" suffix: "2026-06-30 12:00:00.0"
 *
 * @example
 * const client = new ErpnextClient({ url, apiKey, apiSecret });
 * const result = await client.read('Customer', 'CUST-001');
 * console.log(result.data);
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErpnextClientConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
  maxRetries?: number;
  timeout?: number;
  baseDelay?: number;
  maxDelay?: number;
  isMock?: boolean;
}

export interface ErpnextListOptions {
  fields?: string[];
  filters?: Array<Array<string>>;
  limit?: number;
  offset?: number;
}

export interface ErpnextApiResponse {
  data?: Record<string, unknown> | Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface ErpnextEnv {
  ERPNEXT_URL?: string;
  ERPNEXT_API_KEY?: string;
  ERPNEXT_API_SECRET?: string;
  ERPNEXT_SYNC_ENABLED?: string;
}

export interface SalesOrderItem {
  item_code: string;
  qty: number;
  rate?: number;
  amount?: number;
}

export interface LeadPayload {
  lead_name: string;
  company_name?: string;
  mobile_no?: string;
  phone?: string;
  email_id?: string;
  source?: string;
  status?: string;
  city?: string;
  country?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class ErpnextError extends Error {
  status: number;
  excType: string;

  constructor(message: string, status = 500, excType = '') {
    super(message);
    this.name = 'ErpnextError';
    this.status = status;
    this.excType = excType;
  }
}

export class NetworkError extends Error {
  cause: Error | null;

  constructor(message: string, cause: Error | null = null) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

export class MalformedResponseError extends Error {
  body: unknown;

  constructor(message: string, body: unknown = null) {
    super(message);
    this.name = 'MalformedResponseError';
    this.body = body;
  }
}

// ---------------------------------------------------------------------------
// ErpnextClient
// ---------------------------------------------------------------------------

export class ErpnextClient {
  url: string;
  apiKey: string;
  apiSecret: string;
  maxRetries: number;
  timeout: number;
  baseDelay: number;
  maxDelay: number;
  isMock: boolean;

  constructor(config: ErpnextClientConfig) {
    this.url = config.url.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 10000;
    this.baseDelay = config.baseDelay || 1000;
    this.maxDelay = config.maxDelay || 8000;
    this.isMock = config.isMock ?? false;
  }

  getAuthHeader(): string {
    return `token ${this.apiKey}:${this.apiSecret}`;
  }

  private async _request(method: string, path: string, body: Record<string, unknown> | null = null): Promise<ErpnextApiResponse> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this._executeRequest(method, path, body);
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const shouldRetry = this._isRetryableError(error);

        if (shouldRetry && attempt < this.maxRetries - 1) {
          const delay = this._calculateDelay(attempt);
          await this._sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error('Request failed');
  }

  private async _executeRequest(method: string, path: string, body: Record<string, unknown> | null = null): Promise<ErpnextApiResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const headers: Record<string, string> = {
      Authorization: this.getAuthHeader()
    };

    if (body !== null) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(this.url + path, {
        method,
        headers,
        body: body !== null ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      let data: ErpnextApiResponse;
      try {
        data = await response.json() as ErpnextApiResponse;
      } catch (parseError: unknown) {
        const msg = parseError instanceof Error ? parseError.message : String(parseError);
        throw new MalformedResponseError(`Failed to parse response as JSON: ${msg}`, null);
      }

      if (data && (data.exc_type || data.exc)) {
        const message = data._server_messages
          ? this._parseServerMessages(data._server_messages as string)
          : data.exc
            ? String(data.exc).split('\n')[0]
            : `ERPNext error: ${data.exc_type}`;

        throw new ErpnextError(message, response.status, (data.exc_type as string) || '');
      }

      if (!response.ok) {
        const message = data && (data.exc_type || data.message)
          ? (data.exc_type as string) || (data.message as string)
          : `HTTP ${response.status}: ${response.statusText}`;

        throw new ErpnextError(message, response.status, (data && data.exc_type as string) || '');
      }

      return data;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof ErpnextError || error instanceof MalformedResponseError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new NetworkError(`Request timeout after ${this.timeout}ms`);
      }

      if (error instanceof TypeError) {
        throw new NetworkError(error.message);
      }

      const msg = error instanceof Error ? error.message : 'Unknown network error';
      throw new NetworkError(msg);
    }
  }

  private _parseServerMessages(serverMessages: string): string {
    try {
      const parsed: unknown = JSON.parse(serverMessages);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = typeof parsed[0] === 'string' ? JSON.parse(parsed[0]) : parsed[0];
        return (first as Record<string, string>).message || (first as Record<string, string>).title || 'ERPNext error';
      }
      return 'ERPNext error';
    } catch {
      return 'ERPNext error';
    }
  }

  private _isRetryableError(error: unknown): boolean {
    if (error instanceof NetworkError) {
      return true;
    }
    if (error instanceof ErpnextError) {
      return error.status === 429 || (error.status >= 500 && error.status < 600);
    }
    return false;
  }

  private _calculateDelay(attempt: number): number {
    const exponential = this.baseDelay * Math.pow(2, attempt);
    const capped = Math.min(exponential, this.maxDelay);
    const jitter = capped * 0.25 * (Math.random() * 2 - 1);
    return Math.floor(capped + jitter);
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========== CRUD OPERATIONS ==========

  async create(doctype: string, data: Record<string, unknown>): Promise<ErpnextApiResponse> {
    return this._request('POST', `/api/resource/${encodeURIComponent(doctype)}`, data);
  }

  async read(doctype: string, name: string): Promise<ErpnextApiResponse> {
    return this._request('GET', `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`);
  }

  async update(doctype: string, name: string, data: Record<string, unknown>): Promise<ErpnextApiResponse> {
    return this._request('PUT', `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, data);
  }

  put(doctype: string, name: string, data: Record<string, unknown>): Promise<ErpnextApiResponse> {
    return this._request('PUT', `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, data);
  }
  async delete(doctype: string, name: string): Promise<ErpnextApiResponse> {
    return this._request('DELETE', `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`);
  }

  async list(doctype: string, { fields, filters, limit, offset }: ErpnextListOptions = {}): Promise<ErpnextApiResponse> {
    const params = new URLSearchParams();

    if (fields) {
      params.set('fields', JSON.stringify(fields));
    }
    if (filters) {
      params.set('filters', JSON.stringify(filters));
    }
    if (limit !== undefined) {
      params.set('limit_page_length', String(limit));
    }
    if (offset !== undefined) {
      params.set('limit_start', String(offset));
    }

    const queryString = params.toString();
    const path = queryString
      ? `/api/resource/${encodeURIComponent(doctype)}?${queryString}`
      : `/api/resource/${encodeURIComponent(doctype)}`;

    return this._request('GET', path);
  }

  async searchModified(doctype: string, since: string, fields: string[] = ['name', 'modified']): Promise<ErpnextApiResponse> {
    const ts = since.endsWith('.0') ? since : `${since}.0`;
    return this.list(doctype, {
      fields,
      filters: [['modified', '>', ts]],
      limit: 100
    });
  }

  // ========== SPECIFIC DOCTYPE OPERATIONS ==========

  async createInvoice(orderData: Record<string, unknown>): Promise<ErpnextApiResponse> {
    return this.create('Sales Invoice', orderData);
  }

  async getProductAvailability(itemCode: string): Promise<{ item: unknown; stock: Array<Record<string, unknown>> }> {
    const item = await this.read('Item', itemCode);
    const stock = await this.list('Bin', {
      filters: [['item_code', '=', itemCode]],
      fields: ['warehouse', 'actual_qty', 'projected_qty', 'reserved_qty']
    });

    return {
      item: item.data,
      stock: (stock.data as Array<Record<string, unknown>>) || []
    };
  }

  // ── Sales Order ────────────────────────────────────────────────────────────

  createSalesOrder(
    customer: Record<string, unknown>,
    items: SalesOrderItem[]
  ): Promise<ErpnextApiResponse> {
    if (this.isMock) {
      const mockId = `mock-so-${Date.now()}`;
      return Promise.resolve({ data: { name: mockId, mock: true, customer, items } } as ErpnextApiResponse);
    }

    const body: Record<string, unknown> = {
      doctype: 'Sales Order',
      customer: (customer.name as string) || (customer.customer_name as string) || '',
      customer_name: customer.customer_name || customer.name || '',
      delivery_date: new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      items: items.map((it) => ({
        item_code: it.item_code,
        qty: it.qty,
        rate: it.rate ?? 0,
        ...(it.amount !== undefined ? { amount: it.amount } : {})
      })),
      ...customer
    };

    return this.create('Sales Order', body);
  }

  // ── Lead ──────────────────────────────────────────────────────────────────

  createLead(payload: LeadPayload): Promise<ErpnextApiResponse> {
    if (this.isMock) {
      const mockId = `mock-lead-${Date.now()}`;
      return Promise.resolve({ data: { name: mockId, mock: true, ...payload } } as ErpnextApiResponse);
    }

    const { lead_name: ln, company_name: cn, ...rest } = payload;
    const body: Record<string, unknown> = {
      lead_name: ln,
      company_name: cn,
      mobile_no: payload.mobile_no || payload.phone,
      email_id: payload.email_id,
      source: payload.source || 'Walk-in',
      status: payload.status || 'Lead',
      city: payload.city,
      country: payload.country,
      ...rest
    };

    return this.create('Lead', body);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createErpnextClient(env: ErpnextEnv): ErpnextClient | null {
  if (!env.ERPNEXT_URL || !env.ERPNEXT_API_KEY || !env.ERPNEXT_API_SECRET) {
    return null;
  }
  return new ErpnextClient({
    url: env.ERPNEXT_URL,
    apiKey: env.ERPNEXT_API_KEY,
    apiSecret: env.ERPNEXT_API_SECRET,
    isMock: env.ERPNEXT_SYNC_ENABLED !== 'true'
  });
}

export async function createErpnextClientWithKv(
  env: ErpnextEnv & { AUTH_KV?: import('@cloudflare/workers-types').KVNamespace }
): Promise<ErpnextClient | null> {
  // Try KV first (BYOK override)
  let url = env.ERPNEXT_URL;
  let apiKey = env.ERPNEXT_API_KEY;
  let apiSecret = env.ERPNEXT_API_SECRET;

  if (env.AUTH_KV) {
    try {
      const kvUrl = await env.AUTH_KV.get('erpnext:api_url');
      const kvKey = await env.AUTH_KV.get('erpnext:api_key');
      const kvSecret = await env.AUTH_KV.get('erpnext:api_secret');
      if (kvUrl && kvKey && kvSecret) {
        url = kvUrl;
        apiKey = kvKey;
        apiSecret = kvSecret;
      }
    } catch {
      // KV unavailable — fallback to env
    }
  }

  const syncEnabled = env.ERPNEXT_SYNC_ENABLED === 'true';

  if (!url || !apiKey || !apiSecret) {
    return null;
  }
  return new ErpnextClient({ url, apiKey, apiSecret, isMock: !syncEnabled });
}

export default ErpnextClient;
