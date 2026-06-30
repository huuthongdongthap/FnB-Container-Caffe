/**
 * MauticClient — REST API client for Mautic (open-source marketing automation)
 *
 * Runs inside Cloudflare Worker (Hono, D1). Handles OAuth2 client credentials
 * auth, contact management, segment/campaign membership, retry with exponential
 * backoff, and FastCGI header fallback.
 *
 * Auth: OAuth2 Client Credentials (POST /oauth/v2/token)
 * Contacts: POST /api/contacts/new (upsert by email), POST /api/contacts/batch/new
 * Segments: POST /api/segments/{segId}/contact/{contactId}/add
 * Campaigns: POST /api/campaigns/{campId}/contact/{contactId}/add
 *
 * @example
 *   import { MauticClient } from '../lib/mautic-client.js';
 *   const client = new MauticClient('https://mautic.aura.cafe', 'client_id', 'client_secret');
 *   const contactId = await client.createOrUpdateContact({
 *     email: 'user@example.com',
 *     firstname: 'John',
 *     lastname: 'Doe',
 *   });
 */

import { createLogger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Custom Error Classes
// ---------------------------------------------------------------------------

export class MauticError extends Error {
  /**
   * @param {string} message - Human-readable error description
   * @param {number} [status=500] - HTTP status code
   */
  constructor(message, status = 500) {
    super(message);
    this.name = 'MauticError';
    this.status = status;
  }
}

export class MauticAuthError extends MauticError {
  /**
   * @param {string} message - Human-readable error description
   * @param {number} [status=401] - HTTP status code
   */
  constructor(message, status = 401) {
    super(message, status);
    this.name = 'MauticAuthError';
  }
}

export class MauticNetworkError extends Error {
  /**
   * @param {string} message - Human-readable error description
   * @param {Error|null} [cause=null] - Original error
   */
  constructor(message, cause = null) {
    super(message);
    this.name = 'MauticNetworkError';
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 8000;
const TOKEN_EXPIRY_BUFFER_SECONDS = 60;
const PHONE_DOMAIN = '@aura-cafe.internal';
const LOG_ROUTE = 'mautic-client';

// ---------------------------------------------------------------------------
// MauticClient
// ---------------------------------------------------------------------------

export class MauticClient {
  /**
   * @param {string} baseUrl - Mautic instance URL (e.g. "https://mautic.aura.cafe")
   * @param {string} clientId - OAuth2 client ID
   * @param {string} clientSecret - OAuth2 client secret
   */
  constructor(baseUrl, clientId, clientSecret) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.clientId = clientId;
    this.clientSecret = clientSecret;

    /** @private */
    this._token = null;
    /** @private @type {number} epoch ms when token expires */
    this._tokenExpiresAt = 0;
    /** @private flag to send token in POST body instead of Authorization header */
    this._useBodyAuth = false;

    this.maxRetries = DEFAULT_MAX_RETRIES;
    this.baseDelay = DEFAULT_BASE_DELAY_MS;
    this.maxDelay = DEFAULT_MAX_DELAY_MS;

    this._log = createLogger({ route: LOG_ROUTE });
  }

  // ======================================================================
  // Authentication
  // ======================================================================

  /**
   * Obtain an OAuth2 access token via client credentials grant.
   * Caches the token in-memory; subsequent calls return cached token until expiry.
   *
   * POST /oauth/v2/token
   * Body: grant_type=client_credentials&client_id=...&client_secret=...
   *
   * @returns {Promise<string>} Access token
   * @throws {MauticAuthError} On invalid credentials
   * @throws {MauticNetworkError} On network failure
   */
  async authenticate() {
    if (this._token && Date.now() < this._tokenExpiresAt) {
      return this._token;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    let response;
    try {
      response = await fetch(`${this.baseUrl}/oauth/v2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch (err) {
      throw new MauticNetworkError(`Auth network error: ${err.message}`, err);
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new MauticError(`Invalid auth response JSON: ${parseError.message}`, response.status);
    }

    if (!response.ok || !data.access_token) {
      const msg = data.error_description || data.error || 'Authentication failed';
      throw new MauticAuthError(msg, response.status);
    }

    this._token = data.access_token;
    // Subtract buffer for clock skew; store as epoch ms.
    // IMPORTANT: data.expires_in can be 0 — do NOT use `||` fallback (0 is falsy).
    const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
    const rawTtlSec = expiresIn - TOKEN_EXPIRY_BUFFER_SECONDS;
    const ttlSec = Math.max(0, rawTtlSec);
    this._tokenExpiresAt = ttlSec > 0 ? Date.now() + ttlSec * 1000 : 0;

    this._log.info('token_obtained', { route: LOG_ROUTE });
    return this._token;
  }

  /**
   * Ensure a valid token exists, authenticating if needed.
   * @private
   */
  async _ensureAuthenticated() {
    if (!this._token || Date.now() >= this._tokenExpiresAt) {
      await this.authenticate();
    }
  }

  /**
   * Invalidate cached token to force re-authentication.
   * @private
   */
  _invalidateToken() {
    this._token = null;
    this._tokenExpiresAt = 0;
  }

  // ======================================================================
  // Contacts
  // ======================================================================

  /**
   * Create or update a contact by email (Mautic upsert by unique email).
   * For phone-only customers where no email is available, an internal email
   * is generated using the format {phone}@aura-cafe.internal.
   *
   * POST /api/contacts/new
   *
   * @param {Object} params
   * @param {string} [params.email] - Email address (generated from phone if omitted)
   * @param {string} [params.firstname] - Customer first name
   * @param {string} [params.lastname] - Customer last name
   * @param {string} [params.phone] - Phone number
   * @param {Object} [params.customFields] - Additional Mautic contact fields
   * @returns {Promise<number>} Mautic contact ID
   * @throws {MauticError} On API failure
   */
  async createOrUpdateContact({ email, firstname, lastname, phone, customFields } = {}) {
    const resolvedEmail = email || (phone ? `${phone}${PHONE_DOMAIN}` : null);

    const body = {
      ...(resolvedEmail ? { email: resolvedEmail } : {}),
      ...(firstname ? { firstname } : {}),
      ...(lastname ? { lastname } : {}),
      ...(phone ? { phone } : {}),
      ...(customFields || {}),
    };

    const data = await this._request('POST', '/api/contacts/new', body);

    const contact = data && (data.contact || data);
    if (!contact || !contact.id) {
      throw new MauticError('Contact creation returned no ID', 200);
    }

    this._log.info('contact_upserted', { contactId: contact.id, email: resolvedEmail });
    return Number(contact.id);
  }

  /**
   * Batch upsert up to 50 contacts in a single request.
   * For phone-only customers without an email, the internal domain
   * {phone}@aura-cafe.internal is used.
   *
   * POST /api/contacts/batch/new
   *
   * @param {Array<{email?: string, firstname?: string, lastname?: string, phone?: string}>} contacts
   * @returns {Promise<{created: Array, updated: Array, errors: Array}>}
   * @throws {MauticError} On API failure
   */
  async batchUpsertContacts(contacts) {
    // Normalize phone-only contacts
    const normalized = contacts.map((c) => {
      if (!c.email && c.phone) {
        return { ...c, email: `${c.phone}${PHONE_DOMAIN}` };
      }
      return c;
    });

    const data = await this._request('POST', '/api/contacts/batch/new', normalized);

    const created = [];
    const updated = [];
    const errors = [];

    const statusCodes = data.statusCodes || {};
    const responseErrors = data.errors || {};
    const responseContacts = data.contacts || [];

    // Index response contacts by email for quick lookup
    const contactByEmail = {};
    for (const c of responseContacts) {
      if (c.email) {
        contactByEmail[c.email] = c;
      }
    }

    // Classify each input contact by status code or error
    for (const c of normalized) {
      const email = c.email;
      if (responseErrors[email]) {
        const errBody = responseErrors[email];
        errors.push({
          email,
          error: typeof errBody === 'string' ? errBody : errBody.error || 'Unknown error',
        });
      } else if (statusCodes[email] === 200) {
        // HTTP 200 means the contact already existed and was updated
        updated.push(contactByEmail[email] || { email });
      } else {
        // 201 (created) or missing status — treat as created
        created.push(contactByEmail[email] || { email });
      }
    }

    this._log.info('batch_completed', { total: normalized.length, created: created.length, updated: updated.length, errors: errors.length });
    return { created, updated, errors };
  }

  // ======================================================================
  // Segments
  // ======================================================================

  /**
   * Manually add a contact to a segment.
   *
   * POST /api/segments/{segmentId}/contact/{contactId}/add
   *
   * @param {number} contactId - Mautic contact ID
   * @param {number} segmentId - Mautic segment ID
   * @returns {Promise<boolean>} true if successfully added
   */
  async addContactToSegment(contactId, segmentId) {
    try {
      await this._request('POST', `/api/segments/${segmentId}/contact/${contactId}/add`);
      this._log.info('contact_added_to_segment', { contactId, segmentId });
      return true;
    } catch (err) {
      this._log.warn('segment_add_failed', { contactId, segmentId, error: err.message });
      return false;
    }
  }

  // ======================================================================
  // Campaigns
  // ======================================================================

  /**
   * Enroll a contact in a campaign.
   *
   * POST /api/campaigns/{campaignId}/contact/{contactId}/add
   *
   * @param {number} contactId - Mautic contact ID
   * @param {number} campaignId - Mautic campaign ID
   * @returns {Promise<boolean>} true if successfully enrolled
   */
  async addContactToCampaign(contactId, campaignId) {
    try {
      await this._request('POST', `/api/campaigns/${campaignId}/contact/${contactId}/add`);
      this._log.info('contact_added_to_campaign', { contactId, campaignId });
      return true;
    } catch (err) {
      this._log.warn('campaign_add_failed', { contactId, campaignId, error: err.message });
      return false;
    }
  }

  // ======================================================================
  // Internal: HTTP Request with Retry
  // ======================================================================

  /**
   * Core request method with auto-auth, retry, and FastCGI fallback.
   *
   * Retry strategy:
   *   - 5xx: exponential backoff (max this.maxRetries attempts)
   *   - 401: re-authenticate and retry once; then try body-token fallback
   *   - Other 4xx: throw immediately (no retry)
   *   - NetworkError: exponential backoff
   *
   * @param {string} method - HTTP method
   * @param {string} path - URL path relative to baseUrl
   * @param {Object|null} [body=null] - Request body (will be JSON-serialized)
   * @returns {Promise<Object>} Parsed JSON response
   * @throws {MauticError|MauticAuthError|MauticNetworkError}
   * @private
   */
  async _request(method, path, body = null) {
    await this._ensureAuthenticated();

    let lastError;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this._executeRequest(method, path, body);
      } catch (error) {
        lastError = error;

        // 401 on first attempt: token expired; refresh and retry
        if (error instanceof MauticAuthError && attempt === 0) {
          this._invalidateToken();
          await this._ensureAuthenticated();
          continue;
        }

        // 401 on second attempt: try FastCGI body-token fallback
        if (error instanceof MauticAuthError && attempt === 1 && !this._useBodyAuth) {
          this._log.info('fastcgi_fallback_activated');
          this._useBodyAuth = true;
          continue;
        }

        // Retry on 5xx and network errors with backoff
        if (this._isRetryable(error) && attempt < this.maxRetries - 1) {
          const delay = this._calcDelay(attempt);
          await this._sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Execute a single HTTP request without retry logic.
   *
   * @private
   * @param {string} method - HTTP method
   * @param {string} path - URL path
   * @param {Object|null} body - Request body
   * @returns {Promise<Object>} Parsed JSON
   * @throws {MauticError|MauticAuthError|MauticNetworkError}
   */
  async _executeRequest(method, path, body = null) {
    const headers = {};

    if (body !== null) {
      headers['Content-Type'] = 'application/json';
    }

    let requestBody = body !== null ? JSON.stringify(body) : undefined;

    // Attach auth: either Authorization header or body token (FastCGI fallback)
    if (this._useBodyAuth) {
      if (body !== null) {
        const merged = { ...body, access_token: this._token };
        requestBody = JSON.stringify(merged);
      } else {
        requestBody = JSON.stringify({ access_token: this._token });
      }
    } else {
      headers.Authorization = `Bearer ${this._token}`;
    }

    try {
      const response = await fetch(this.baseUrl + path, {
        method,
        headers,
        body: requestBody,
      });

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new MauticError(
          `Invalid JSON response: ${parseError.message}`,
          response.status,
        );
      }

      // 401 — authentication failure (triggers refresh in _request)
      if (response.status === 401) {
        throw new MauticAuthError(
          (data && data.error) || 'Authentication failed',
          401,
        );
      }

      if (!response.ok) {
        const msg = (data && (data.error || (data.errors && Object.values(data.errors).join('; '))))
          || `HTTP ${response.status}: ${response.statusText || 'Unknown'}`;
        throw new MauticError(msg, response.status);
      }

      return data;
    } catch (error) {
      // Re-throw known error types; wrap everything else as network error
      if (error instanceof MauticError || error instanceof MauticAuthError) {
        throw error;
      }
      throw new MauticNetworkError(error.message || 'Network request failed', error);
    }
  }

  /**
   * Determine if an error is eligible for retry.
   * @private
   * @param {Error} error
   * @returns {boolean}
   */
  _isRetryable(error) {
    if (error instanceof MauticNetworkError) {
      return true;
    }
    if (error instanceof MauticError) {
      // Retry on server errors only
      return error.status >= 500 && error.status < 600;
    }
    return false;
  }

  /**
   * Calculate exponential backoff delay with jitter.
   * @private
   * @param {number} attempt - Zero-based attempt number
   * @returns {number} Delay in milliseconds
   */
  _calcDelay(attempt) {
    const exponential = this.baseDelay * 2 ** attempt;
    const capped = Math.min(exponential, this.maxDelay);
    const jitter = capped * 0.25 * (Math.random() * 2 - 1);
    return Math.floor(capped + jitter);
  }

  /**
   * Sleep utility (promisified setTimeout).
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a MauticClient from environment bindings.
 *
 * @param {Object} env - Environment bindings (CF Worker env)
 * @param {string} [env.MAUTIC_BASE_URL] - Mautic instance URL
 * @param {string} [env.MAUTIC_CLIENT_ID] - OAuth2 client ID
 * @param {string} [env.MAUTIC_CLIENT_SECRET] - OAuth2 client secret
 * @returns {MauticClient|null} Client instance or null if not fully configured
 */
export function createMauticClient(env) {
  if (!env.MAUTIC_BASE_URL || !env.MAUTIC_CLIENT_ID || !env.MAUTIC_CLIENT_SECRET) {
    return null;
  }
  return new MauticClient(env.MAUTIC_BASE_URL, env.MAUTIC_CLIENT_ID, env.MAUTIC_CLIENT_SECRET);
}

export default MauticClient;
