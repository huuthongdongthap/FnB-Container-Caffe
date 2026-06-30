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

// Custom Error Classes
export class ErpnextError extends Error {
  constructor(message, status = 500, excType = '') {
    super(message);
    this.name = 'ErpnextError';
    this.status = status;
    this.excType = excType;
  }
}

export class NetworkError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

export class MalformedResponseError extends Error {
  constructor(message, body = null) {
    super(message);
    this.name = 'MalformedResponseError';
    this.body = body;
  }
}

/**
 * ErpnextClient main class
 */
export class ErpnextClient {
  constructor(config) {
    this.url = config.url.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 10000;
    this.baseDelay = config.baseDelay || 1000;
    this.maxDelay = config.maxDelay || 8000;
  }

  /**
   * Get authentication header value
   * @returns {string} Token header value
   */
  getAuthHeader() {
    return `token ${this.apiKey}:${this.apiSecret}`;
  }

  /**
   * Base HTTP request with retry, timeout, and error handling
   * @param {string} method - HTTP method
   * @param {string} path - URL path (e.g., /api/resource/Customer)
   * @param {Object|null} body - Request body for POST/PUT
   * @returns {Promise<Object>} Parsed JSON response
   */
  async _request(method, path, body = null) {
    let lastError;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this._executeRequest(method, path, body);
      } catch (error) {
        lastError = error;

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

  /**
   * Execute a single HTTP request (no retry)
   * @private
   */
  async _executeRequest(method, path, body = null) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const headers = {
      Authorization: this.getAuthHeader(),
    };

    if (body !== null) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(this.url + path, {
        method,
        headers,
        body: body !== null ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new MalformedResponseError(
          `Failed to parse response as JSON: ${parseError.message}`,
          null
        );
      }

      // Check for ERPNext API error in body (can happen even with HTTP 200)
      if (data && (data.exc_type || data.exc)) {
        const message = data._server_messages
          ? this._parseServerMessages(data._server_messages)
          : data.exc
            ? data.exc.split('\n')[0]
            : `ERPNext error: ${data.exc_type}`;

        throw new ErpnextError(message, response.status, data.exc_type || '');
      }

      if (!response.ok) {
        const message = data && (data.exc_type || data.message)
          ? data.exc_type || data.message
          : `HTTP ${response.status}: ${response.statusText}`;

        throw new ErpnextError(message, response.status, (data && data.exc_type) || '');
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ErpnextError || error instanceof MalformedResponseError) {
        throw error;
      }

      if (error.name === 'AbortError') {
        throw new NetworkError(`Request timeout after ${this.timeout}ms`);
      }

      if (error instanceof TypeError) {
        throw new NetworkError(error.message);
      }

      throw new NetworkError(error.message || 'Unknown network error');
    }
  }

  /**
   * Parse ERPNext _server_messages JSON field into readable string
   * @private
   */
  _parseServerMessages(serverMessages) {
    try {
      const parsed = JSON.parse(serverMessages);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = typeof parsed[0] === 'string' ? JSON.parse(parsed[0]) : parsed[0];
        return first.message || first.title || 'ERPNext error';
      }
      return 'ERPNext error';
    } catch {
      return 'ERPNext error';
    }
  }

  /**
   * Check if error is retryable (network issues, 429, 5xx)
   * @private
   */
  _isRetryableError(error) {
    if (error instanceof NetworkError) {
      return true;
    }

    if (error instanceof ErpnextError) {
      // Retry on rate limiting and server errors
      if (error.status === 429 || (error.status >= 500 && error.status < 600)) {
        return true;
      }
      return false;
    }

    return false;
  }

  /**
   * Calculate exponential backoff delay with jitter
   * @private
   */
  _calculateDelay(attempt) {
    const exponential = this.baseDelay * Math.pow(2, attempt);
    const capped = Math.min(exponential, this.maxDelay);
    const jitter = capped * 0.25 * (Math.random() * 2 - 1);
    return Math.floor(capped + jitter);
  }

  /**
   * Sleep utility
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========== CRUD OPERATIONS ==========

  /**
   * Create a new record
   * POST /api/resource/{doctype}
   * @param {string} doctype - ERPNext DocType (e.g., 'Sales Invoice')
   * @param {Object} data - Document data
   * @returns {Promise<Object>} Response with data property
   */
  async create(doctype, data) {
    return this._request('POST', `/api/resource/${encodeURIComponent(doctype)}`, data);
  }

  /**
   * Read a single record by name
   * GET /api/resource/{doctype}/{name}
   * @param {string} doctype - ERPNext DocType
   * @param {string} name - Document name/ID
   * @returns {Promise<Object>} Response with data property
   */
  async read(doctype, name) {
    return this._request('GET', `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`);
  }

  /**
   * Update an existing record
   * PUT /api/resource/{doctype}/{name}
   * @param {string} doctype - ERPNext DocType
   * @param {string} name - Document name/ID
   * @param {Object} data - Fields to update
   * @returns {Promise<Object>} Response with data property
   */
  async update(doctype, name, data) {
    return this._request('PUT', `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, data);
  }

  /**
   * Delete a record
   * DELETE /api/resource/{doctype}/{name}
   * @param {string} doctype - ERPNext DocType
   * @param {string} name - Document name/ID
   * @returns {Promise<Object>} Response
   */
  async delete(doctype, name) {
    return this._request('DELETE', `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`);
  }

  /**
   * List records with optional filtering and pagination
   * GET /api/resource/{doctype}?fields=...&filters=...&limit_page_length=...&limit_start=...
   * @param {string} doctype - ERPNext DocType
   * @param {Object} [options] - Query options
   * @param {string[]} [options.fields] - Fields to return
   * @param {Array[]} [options.filters] - Filter array: [["field","op","value"],...]
   * @param {number} [options.limit] - Page size (default 20, max 1000)
   * @param {number} [options.offset] - Starting offset
   * @returns {Promise<Object>} Response with data array
   */
  async list(doctype, { fields, filters, limit, offset } = {}) {
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

  /**
   * Search records modified after a given timestamp
   * ERPNext requires ".0" suffix on timestamp values
   *
   * @param {string} doctype - ERPNext DocType
   * @param {string} since - ISO timestamp or ERPNext datetime string
   * @param {string[]} [fields] - Fields to return (default: ['name', 'modified'])
   * @returns {Promise<Object>} Response with data array
   */
  async searchModified(doctype, since, fields = ['name', 'modified']) {
    // ERPNext timestamps MUST have ".0" suffix
    const ts = since.endsWith('.0') ? since : since + '.0';
    return this.list(doctype, {
      fields,
      filters: [['modified', '>', ts]],
      limit: 100,
    });
  }

  // ========== SPECIFIC ERPNext DOCTYPE OPERATIONS ==========

  /**
   * Create a Sales Invoice from order data
   * POST /api/resource/Sales%20Invoice
   *
   * @param {Object} orderData - Sales invoice data
   * @returns {Promise<Object>} Response with data containing the created invoice
   */
  async createInvoice(orderData) {
    return this.create('Sales Invoice', orderData);
  }

  /**
   * Get product availability (Item + Bin stock levels)
   * Queries Item record and Bin records for stock information
   *
   * @param {string} itemCode - Item code
   * @returns {Promise<{item: Object, stock: Array}>} Item details and stock levels
   */
  async getProductAvailability(itemCode) {
    const item = await this.read('Item', itemCode);
    const stock = await this.list('Bin', {
      filters: [['item_code', '=', itemCode]],
      fields: ['warehouse', 'actual_qty', 'projected_qty', 'reserved_qty'],
    });

    return {
      item: item.data,
      stock: stock.data || [],
    };
  }
}

/**
 * Factory: Create ErpnextClient from environment bindings
 * @param {Object} env - Environment bindings (must have ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET)
 * @returns {ErpnextClient|null} Client instance or null if not configured
 */
export function createErpnextClient(env) {
  if (!env.ERPNEXT_URL || !env.ERPNEXT_API_KEY || !env.ERPNEXT_API_SECRET) {
    return null;
  }
  return new ErpnextClient({
    url: env.ERPNEXT_URL,
    apiKey: env.ERPNEXT_API_KEY,
    apiSecret: env.ERPNEXT_API_SECRET,
  });
}

export default ErpnextClient;
