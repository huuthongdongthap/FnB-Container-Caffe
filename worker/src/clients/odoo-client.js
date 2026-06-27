/**
 * OdooClient — JSON-RPC client for Odoo ERP
 *
 * Handles authentication, retry logic with exponential backoff,
 * and standard CRUD operations (create, read, update, searchRead).
 *
 * Phase 1: Accounting integration (account.move invoices)
 *
 * @example
 * const client = new OdooClient({ env });
 * await client.authenticate();
 * const invoiceId = await client.create('account.move', values);
 */

// Custom Error Classes
export class NetworkError extends Error {
  constructor(message, statusCode = null) {
    super(message);
    this.name = 'NetworkError';
    this.statusCode = statusCode;
  }
}

export class OdooError extends Error {
  constructor(message, code = 'UNKNOWN', data = {}) {
    super(message);
    this.name = 'OdooError';
    this.code = code;
    this.data = data;
  }
}

export class MalformedResponseError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'MalformedResponseError';
    this.originalError = originalError;
  }
}

/**
 * OdooClient main class
 */
export class OdooClient {
  constructor(config) {
    if (!config.url) {throw new Error('OdooClient: url is required');}
    if (!config.db) {throw new Error('OdooClient: db is required');}
    if (!config.username) {throw new Error('OdooClient: username is required');}
    if (!config.apiKey) {throw new Error('OdooClient: apiKey is required');}

    this.url = config.url.replace(/\/$/, '');
    this.db = config.db;
    this.username = config.username;
    this.apiKey = config.apiKey;
    this.auraDb = config.auraDb || null; // D1 database for sync mappings
    this.uid = null;

    // Retry configuration
    this.maxAttempts = config.maxAttempts || 3;
    this.baseDelay = config.baseDelay || 1000;
    this.maxDelay = config.maxDelay || 8000;

    this.retryableCodes = new Set([
      'odoo_retry',
      'odoo_service_unavailable',
      'odoo_timeout',
      'conn_lost',
      'client_error',
    ]);
  }

  /**
   * Authenticate with Odoo and establish session
   * Sets this.uid on success
   */
  async authenticate() {
    if (this.uid !== null) {
      return this.uid;
    }

    const payload = {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'common',
        method: 'login',
        args: [this.db, this.username, this.apiKey],
      },
      id: 1,
    };

    const response = await this.makeRequest(payload, { isAuth: true });

    // Check for JSON-RPC error
    if (response && response.error) {
      throw new OdooError(response.error.message || 'Auth failed', response.error.code || 'AUTH_FAILED');
    }

    const uid = response.result;

    if (typeof uid !== 'number' || uid <= 0) {
      throw new Error(`Odoo authentication failed: invalid uid ${uid}`);
    }

    this.uid = uid;
    return this.uid;
  }

  /**
   * Execute JSON-RPC call with retry logic
   */
  async call(model, method, args = [], options = {}) {
    await this.authenticate();

    const payload = {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'object',
        method: 'execute',
        args: [this.db, this.uid, this.apiKey, model, method, ...args],
        kwargs: {},
      },
      id: options.id || this._generateRequestId(),
    };

    return this.makeRequestWithRetry(payload, options);
  }

  /**
   * Create a record and return its ID
   */
  async create(model, values) {
    const result = await this.call(model, 'create', [values]);
    if (typeof result !== 'number') {
      throw new Error(`Odoo create expected number ID, got ${typeof result}`);
    }
    return result;
  }

  /**
   * Read records by IDs
   * Returns array of records (empty if not found)
   */
  async read(model, ids, fields = []) {
    const result = await this.call(model, 'read', [ids, fields]);
    if (Array.isArray(result)) {
      return result;
    }
    if (result === false) {
      return [];
    }
    throw new Error(`Odoo read expected array, got ${typeof result}`);
  }

  /**
   * Update records
   * Returns true on success
   */
  /**
 * Write records (alias for update — Odoo write method)
 * Returns true on success
 */
  async write(model, ids, values) {
    return this.update(model, ids, values);
  }

  async update(model, ids, values) {
    const normalizedIds = Array.isArray(ids) ? ids : [ids];
    const result = await this.call(model, 'write', [normalizedIds, values]);
    return result === true;
  }

  /**
   * Search and read records with domain filtering
   * domain: [['field', 'operator', 'value'], ...]
   * Returns array of records
   */
  async searchRead(model, domain = [], fields = [], options = {}) {
    const result = await this.call(model, 'search_read', [domain, fields, options]);
    if (Array.isArray(result)) {
      return result;
    }
    throw new Error(`Odoo searchRead expected array, got ${typeof result}`);
  }

  /**
   * Search for record IDs matching domain
   * Returns array of IDs
   */
  async search(model, domain = [], limit = 0, offset = 0) {
    const result = await this.call(model, 'search', [domain, limit, offset]);
    if (Array.isArray(result)) {
      return result;
    }
    throw new Error(`Odoo search expected array, got ${typeof result}`);
  }

  /**
   * Unlink (delete) records
   * Returns true on success
   */
  async unlink(model, ids) {
    const normalizedIds = Array.isArray(ids) ? ids : [ids];
    return this.call(model, 'unlink', [normalizedIds]);
  }

  /**
   * Execute custom method
   */
  async execute(model, method, args = []) {
    return this.call(model, method, args);
  }

  // ========== ACCOUNTING PHASE METHODS ==========

  /**
   * Find existing mapping for local entity
   * @returns {Promise<Object|null>} Mapping record or null
   */
  async findMapping(localType, localId) {
    if (!this.auraDb) {
      throw new Error('AURA_DB not configured in OdooClient');
    }
    const stmt = this.auraDb.prepare(
      'SELECT * FROM odoo_mappings WHERE local_type = ? AND local_id = ? LIMIT 1'
    ).bind(localType, localId);
    return await stmt.first();
  }

  /**
   * Create mapping record
   * @private
   */
  async _createMapping(localType, localId, odooId, odooModel, status, error = null) {
    if (!this.auraDb) {
      throw new Error('AURA_DB not configured in OdooClient');
    }
    const stmt = this.auraDb.prepare(`
      INSERT INTO odoo_mappings (local_type, local_id, odoo_id, odoo_model, sync_status, error_message, attempts, last_synced_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
      ON CONFLICT(local_type, local_id) DO UPDATE SET
        odoo_id = excluded.odoo_id,
        odoo_model = excluded.odoo_model,
        sync_status = excluded.sync_status,
        error_message = excluded.error_message,
        attempts = odoo_mappings.attempts + 1,
        last_synced_at = datetime('now')
    `);
    await stmt.bind(localType, localId, odooId, odooModel, status, error).run();
  }

  /**
   * Mark mapping as failed
   */
  async markMappingFailed(localType, localId, error) {
    if (!this.auraDb) {
      throw new Error('AURA_DB not configured in OdooClient');
    }
    const stmt = this.auraDb.prepare(`
      UPDATE odoo_mappings
      SET sync_status = 'failed',
          error_message = ?,
          attempts = attempts + 1,
          updated_at = datetime('now')
      WHERE local_type = ? AND local_id = ?
    `);
    await stmt.bind(error, localType, localId).run();
  }

  /**
   * Accounting: Create customer invoice from completed order
   * Idempotent: checks mapping first
   *
   * @param {Object} order - Order DB row
   * @param {Array} items - Parsed order items array
   * @returns {Promise<{alreadySynced: boolean, odooInvoiceId?: number, mappingId?: number}>}
   */
  async createInvoice(order, items) {
    // Check if already synced
    const existing = await this.findMapping('order', order.id);
    if (existing && existing.sync_status === 'synced') {
      this._log('info', 'Order already has Odoo invoice', { orderId: order.id, mappingId: existing.id });
      return { alreadySynced: true, mappingId: existing.id };
    }

    // Find or create Odoo partner (customer)
    const odooPartnerId = await this._getOrCreateOdooPartner(order);
    if (!odooPartnerId) {
      throw new Error(`Failed to get/create Odoo partner for order ${order.id}`);
    }

    // Build invoice lines
    const invoiceLines = await this._buildInvoiceLines(items, odooPartnerId);

    // Create invoice record
    const invoiceValues = {
      move_type: 'out_invoice',
      partner_id: odooPartnerId,
      invoice_date: new Date().toISOString().split('T')[0],
      invoice_line_ids: invoiceLines,
      ref: `AURA-${order.id}`,
      x_aura_order_id: order.id,
    };

    const odooInvoiceId = await this.create('account.move', invoiceValues);

    // Create/update mapping
    await this._createMapping(
      'order',
      order.id,
      odooInvoiceId,
      'account.move',
      'synced'
    );

    this._log('info', 'Odoo invoice created', {
      orderId: order.id,
      odooInvoiceId,
    });

    return { alreadySynced: false, odooInvoiceId };
  }

  /**
   * Find existing Odoo partner or create new from order data
   * @private
   */
  async _getOrCreateOdooPartner(order) {
    // Try to find by email or phone first
    const domain = [];
    if (order.customer_email) {
      domain.push(['email', '=', order.customer_email]);
    }
    if (order.customer_phone) {
      if (domain.length) {domain.push('|');}
      domain.push(['phone', '=', order.customer_phone]);
    }

    if (domain.length) {
      const existing = await this.searchRead('res.partner', domain, ['id'], { limit: 1 });
      if (existing && existing.length > 0) {
        return existing[0].id;
      }
    }

    // Create new partner
    const partnerValues = {
      name: order.customer_name || 'Unknown Customer',
      email: order.customer_email || '',
      phone: order.customer_phone || '',
      company_type: 'person',
      customer_rank: 1,
    };

    return await this.create('res.partner', partnerValues);
  }

  /**
   * Build Odoo invoice line records from order items
   * @private
   */
  async _buildInvoiceLines(items) {
    const incomeAccountId = await this._findDefaultIncomeAccount();
    const lines = [];

    for (const item of items) {
      const product = await this._findOrCreateProduct(item);
      const quantity = item.quantity || item.qty || 1;
      const unitPrice = Math.round((item.price || item.unit_price || 0) * 100) / 100;

      lines.push([
        0, 0,
        {
          product_id: product.id,
          quantity: quantity,
          price_unit: unitPrice,
          account_id: incomeAccountId,
          name: item.name || item.product_name || 'Product',
        },
      ]);
    }

    return lines;
  }

  /**
   * Find default income account for invoices
   * @private
   */
  async _findDefaultIncomeAccount() {
    const accounts = await this.searchRead('account.account', [['account_type', '=', 'income']], ['id'], { limit: 1 });
    if (accounts && accounts.length > 0) {
      return accounts[0].id;
    }
    throw new Error('No income account found in Odoo chart of accounts');
  }

  /**
   * Find product by name or create placeholder
   * @private
   */
  async _findOrCreateProduct(item) {
    const productName = item.name || item.product_name || 'Unknown Product';

    // Try to find by name
    const existing = await this.searchRead('product.product', [
      ['name', '=', productName],
      ['sale_ok', '=', true]
    ], ['id'], { limit: 1 });

    if (existing && existing.length > 0) {
      return existing[0];
    }

    // Create placeholder product
    const productValues = {
      name: productName,
      type: 'service',
      sale_ok: true,
      purchase_ok: false,
      list_price: item.price || item.unit_price || 0,
    };

    const productId = await this.create('product.product', productValues);

    // Also create product template (required for some Odoo versions)
    try {
      await this.create('product.template', {
        name: productName,
        type: 'service',
        sale_ok: true,
        list_price: item.price || item.unit_price || 0,
      });
    } catch {
      // Template might auto-create, ignore errors
    }

    return { id: productId };
  }

  /**
   * Structured logging wrapper
   * @private
   */
  _log(level, message, meta = {}) {
    const logger = this.logger;
    if (logger && typeof logger[level] === 'function') {
      logger[level](message, meta);
    }
  }

  /**
   * Make HTTP request with retry logic
   */
  async makeRequestWithRetry(payload, options = {}) {
    let lastError;

    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      try {
        const response = await this.makeRequest(payload, options);

        if (response && response.error) {
          const error = this.parseOdooError(response.error);
          if (this.isRetryableError(error) && attempt < this.maxAttempts - 1) {
            lastError = error;
            const delay = this.calculateDelay(attempt);
            await this.sleep(delay);
            continue;
          }
          throw error;
        }

        return response.result;
      } catch (error) {
        lastError = error;
        const shouldRetry = this.isNetworkError(error) || (error.odooCode && this.isRetryableError(error));

        if (shouldRetry && attempt < this.maxAttempts - 1) {
          const delay = this.calculateDelay(attempt);
          await this.sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw new Error(`Max attempts (${this.maxAttempts}) exceeded. Last error: ${lastError?.message || lastError}`);
  }

  /**
   * Single HTTP request (no retry)
   */
  async makeRequest(payload, options = {}) {
    const controller = new AbortController();
    const timeout = options.timeout || 30000;

    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(this.url + '/jsonrpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new NetworkError(`HTTP ${response.status}: ${response.statusText}`, response.status);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new NetworkError(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Parse Odoo error response
   */
  parseOdooError(errorData) {
    const message = errorData.message || 'Unknown Odoo error';
    const code = errorData.code || 'unknown';
    const error = new Error(`Odoo error [${code}]: ${message}`);
    error.odooCode = code;
    error.odooData = errorData.data || {};
    return error;
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    if (!error) {return false;}
    // Check both odooCode (from parseOdooError) and code (from OdooError constructor)
    const code = error.odooCode || error.code;
    if (code && this.retryableCodes.has(code)) {
      return true;
    }
    if (error.odooData?.traceback) {
      const traceback = String(error.odooData.traceback).toLowerCase();
      const transientPatterns = ['timeout', 'connection', 'temporarily unavailable', 'try again'];
      if (transientPatterns.some(pattern => traceback.includes(pattern))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if error is network-related
   */
  isNetworkError(error) {
    if (!error) {return false;}
    if (error.name === 'TypeError' || error.name === 'NetworkError') {
      return true;
    }
    const message = String(error.message || '').toLowerCase();
    const networkPatterns = ['failed to fetch', 'network error', 'connection reset', 'econnreset', 'timeout'];
    return networkPatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Calculate exponential backoff delay
   */
  calculateDelay(attempt) {
    const exponential = this.baseDelay * Math.pow(2, attempt);
    const capped = Math.min(exponential, this.maxDelay);
    const jitter = capped * 0.25 * (Math.random() * 2 - 1);
    return Math.floor(capped + jitter);
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique request ID
   */
  _generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Factory: Create OdooClient with environment bindings
 * @param {Object} env - Cloudflare environment bindings
 * @returns {OdooClient|null}
 */
export function createOdooClient(env) {
  if (!env.ODOO_URL || !env.ODOO_DB || !env.ODOO_USERNAME || !env.ODOO_API_KEY) {
    return null;
  }
  return new OdooClient({
    url: env.ODOO_URL,
    db: env.ODOO_DB,
    username: env.ODOO_USERNAME,
    apiKey: env.ODOO_API_KEY,
    auraDb: env.AURA_DB,
  });
}

export default OdooClient;
