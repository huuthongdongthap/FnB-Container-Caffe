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
 *   import { MauticClient } from '../lib/mautic-client';
 *   const client = new MauticClient('https://mautic.aura.cafe', 'client_id', 'client_secret');
 *   const contactId = await client.createOrUpdateContact({
 *     email: 'user@example.com',
 *     firstname: 'John',
 *     lastname: 'Doe',
 *   });
 */

import { createLogger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Custom Error Classes
// ---------------------------------------------------------------------------

export class MauticError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'MauticError';
    this.status = status;
  }
}

export class MauticAuthError extends MauticError {
  constructor(message: string, status = 401) {
    super(message, status);
    this.name = 'MauticAuthError';
  }
}

export class MauticNetworkError extends Error {
  cause: Error | null;

  constructor(message: string, cause: Error | null = null) {
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
// Types
// ---------------------------------------------------------------------------

export interface MauticContactInput {
  email?: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  customFields?: Record<string, unknown>;
}

export interface MauticBatchContact {
  email?: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
}

export interface MauticBatchResult {
  created: Array<Record<string, unknown>>;
  updated: Array<Record<string, unknown>>;
  errors: Array<{ email: string; error: string }>;
}

export interface MauticEnv {
  MAUTIC_BASE_URL?: string;
  MAUTIC_CLIENT_ID?: string;
  MAUTIC_CLIENT_SECRET?: string;
}

// ---------------------------------------------------------------------------
// MauticClient
// ---------------------------------------------------------------------------

export class MauticClient {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;

  private _token: string | null;
  private _tokenExpiresAt: number;
  private _useBodyAuth: boolean;
  private _log: ReturnType<typeof createLogger>;

  constructor(baseUrl: string, clientId: string, clientSecret: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.clientId = clientId;
    this.clientSecret = clientSecret;

    this._token = null;
    this._tokenExpiresAt = 0;
    this._useBodyAuth = false;

    this.maxRetries = DEFAULT_MAX_RETRIES;
    this.baseDelay = DEFAULT_BASE_DELAY_MS;
    this.maxDelay = DEFAULT_MAX_DELAY_MS;

    this._log = createLogger({ route: LOG_ROUTE });
  }

  // ======================================================================
  // Authentication
  // ======================================================================

  async authenticate(): Promise<string> {
    if (this._token && Date.now() < this._tokenExpiresAt) {
      return this._token;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/oauth/v2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new MauticNetworkError(`Auth network error: ${msg}`, err instanceof Error ? err : null);
    }

    let data: Record<string, unknown>;
    try {
      data = await response.json() as Record<string, unknown>;
    } catch (parseError: unknown) {
      const msg = parseError instanceof Error ? parseError.message : String(parseError);
      throw new MauticError(`Invalid auth response JSON: ${msg}`, response.status);
    }

    if (!response.ok || !data.access_token) {
      const msg = (data.error_description as string) || (data.error as string) || 'Authentication failed';
      throw new MauticAuthError(msg, response.status);
    }

    this._token = data.access_token as string;
    const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
    const rawTtlSec = expiresIn - TOKEN_EXPIRY_BUFFER_SECONDS;
    const ttlSec = Math.max(0, rawTtlSec);
    this._tokenExpiresAt = ttlSec > 0 ? Date.now() + ttlSec * 1000 : 0;

    this._log.info('token_obtained', { route: LOG_ROUTE });
    return this._token;
  }

  private async _ensureAuthenticated(): Promise<void> {
    if (!this._token || Date.now() >= this._tokenExpiresAt) {
      await this.authenticate();
    }
  }

  private _invalidateToken(): void {
    this._token = null;
    this._tokenExpiresAt = 0;
  }

  // ======================================================================
  // Contacts
  // ======================================================================

  async createOrUpdateContact({ email, firstname, lastname, phone, customFields }: MauticContactInput = {}): Promise<number> {
    const resolvedEmail = email || (phone ? `${phone}${PHONE_DOMAIN}` : null);

    const body: Record<string, unknown> = {
      ...(resolvedEmail ? { email: resolvedEmail } : {}),
      ...(firstname ? { firstname } : {}),
      ...(lastname ? { lastname } : {}),
      ...(phone ? { phone } : {}),
      ...(customFields || {}),
    };

    const data = await this._request('POST', '/api/contacts/new', body);

    const contact = (data && ((data as Record<string, unknown>).contact || data)) as Record<string, unknown> | undefined;
    if (!contact || !contact.id) {
      throw new MauticError('Contact creation returned no ID', 200);
    }

    this._log.info('contact_upserted', { contactId: contact.id, email: resolvedEmail });
    return Number(contact.id);
  }

  async batchUpsertContacts(contacts: MauticBatchContact[]): Promise<MauticBatchResult> {
    const normalized = contacts.map((c) => {
      if (!c.email && c.phone) {
        return { ...c, email: `${c.phone}${PHONE_DOMAIN}` };
      }
      return c;
    });

    const data = await this._request('POST', '/api/contacts/batch/new', normalized as unknown as Record<string, unknown>);

    const created: Array<Record<string, unknown>> = [];
    const updated: Array<Record<string, unknown>> = [];
    const errors: Array<{ email: string; error: string }> = [];

    const statusCodes = (data as Record<string, unknown>).statusCodes as Record<string, number> || {};
    const responseErrors = (data as Record<string, unknown>).errors as Record<string, unknown> || {};
    const responseContacts = ((data as Record<string, unknown>).contacts as Array<Record<string, unknown>>) || [];

    const contactByEmail: Record<string, Record<string, unknown>> = {};
    for (const c of responseContacts) {
      if (c.email) {
        contactByEmail[c.email as string] = c;
      }
    }

    for (const c of normalized) {
      const email = c.email || '';
      if (responseErrors[email]) {
        const errBody = responseErrors[email];
        errors.push({
          email,
          error: typeof errBody === 'string' ? errBody : (errBody as Record<string, unknown>)?.error as string || 'Unknown error',
        });
      } else if (statusCodes[email] === 200) {
        updated.push(contactByEmail[email] || { email });
      } else {
        created.push(contactByEmail[email] || { email });
      }
    }

    this._log.info('batch_completed', { total: normalized.length, created: created.length, updated: updated.length, errors: errors.length });
    return { created, updated, errors };
  }

  // ======================================================================
  // Segments
  // ======================================================================

  async addContactToSegment(contactId: number, segmentId: number): Promise<boolean> {
    try {
      await this._request('POST', `/api/segments/${segmentId}/contact/${contactId}/add`);
      this._log.info('contact_added_to_segment', { contactId, segmentId });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this._log.warn('segment_add_failed', { contactId, segmentId, error: msg });
      return false;
    }
  }

  // ======================================================================
  // Campaigns
  // ======================================================================

  async addContactToCampaign(contactId: number, campaignId: number): Promise<boolean> {
    try {
      await this._request('POST', `/api/campaigns/${campaignId}/contact/${contactId}/add`);
      this._log.info('contact_added_to_campaign', { contactId, campaignId });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this._log.warn('campaign_add_failed', { contactId, campaignId, error: msg });
      return false;
    }
  }

  // ======================================================================
  // Internal: HTTP Request with Retry
  // ======================================================================

  private async _request(method: string, path: string, body: Record<string, unknown> | null = null): Promise<Record<string, unknown>> {
    await this._ensureAuthenticated();

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this._executeRequest(method, path, body);
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof MauticAuthError && attempt === 0) {
          this._invalidateToken();
          await this._ensureAuthenticated();
          continue;
        }

        if (error instanceof MauticAuthError && attempt === 1 && !this._useBodyAuth) {
          this._log.info('fastcgi_fallback_activated');
          this._useBodyAuth = true;
          continue;
        }

        if (this._isRetryable(error) && attempt < this.maxRetries - 1) {
          const delay = this._calcDelay(attempt);
          await this._sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error('Unexpected retry exhaustion');
  }

  private async _executeRequest(method: string, path: string, body: Record<string, unknown> | null = null): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {};

    if (body !== null) {
      headers['Content-Type'] = 'application/json';
    }

    let requestBody: string | undefined = body !== null ? JSON.stringify(body) : undefined;

    if (this._useBodyAuth) {
      if (body !== null) {
        const merged = { ...body, access_token: this._token };
        requestBody = JSON.stringify(merged);
      } else {
        requestBody = JSON.stringify({ access_token: this._token });
      }
    } else {
      headers['Authorization'] = `Bearer ${this._token}`;
    }

    try {
      const response = await fetch(this.baseUrl + path, {
        method,
        headers,
        body: requestBody,
      });

      let data: Record<string, unknown>;
      try {
        data = await response.json() as Record<string, unknown>;
      } catch (parseError: unknown) {
        const msg = parseError instanceof Error ? parseError.message : String(parseError);
        throw new MauticError(`Invalid JSON response: ${msg}`, response.status);
      }

      if (response.status === 401) {
        throw new MauticAuthError(
          (data && (data.error as string)) || 'Authentication failed',
          401,
        );
      }

      if (!response.ok) {
        const errorsObj = data?.errors;
        const errorsStr = errorsObj && typeof errorsObj === 'object'
          ? Object.values(errorsObj as Record<string, unknown>).join('; ')
          : '';
        const msg = (data && ((data.error as string) || errorsStr))
          || `HTTP ${response.status}: ${response.statusText || 'Unknown'}`;
        throw new MauticError(msg, response.status);
      }

      return data;
    } catch (error: unknown) {
      if (error instanceof MauticError || error instanceof MauticAuthError) {
        throw error;
      }
      const msg = error instanceof Error ? error.message : 'Network request failed';
      throw new MauticNetworkError(msg, error instanceof Error ? error : null);
    }
  }

  private _isRetryable(error: unknown): boolean {
    if (error instanceof MauticNetworkError) {
      return true;
    }
    if (error instanceof MauticError) {
      return error.status >= 500 && error.status < 600;
    }
    return false;
  }

  private _calcDelay(attempt: number): number {
    const exponential = this.baseDelay * 2 ** attempt;
    const capped = Math.min(exponential, this.maxDelay);
    const jitter = capped * 0.25 * (Math.random() * 2 - 1);
    return Math.floor(capped + jitter);
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createMauticClient(env: MauticEnv): MauticClient | null {
  if (!env.MAUTIC_BASE_URL || !env.MAUTIC_CLIENT_ID || !env.MAUTIC_CLIENT_SECRET) {
    return null;
  }
  return new MauticClient(env.MAUTIC_BASE_URL, env.MAUTIC_CLIENT_ID, env.MAUTIC_CLIENT_SECRET);
}

export default MauticClient;
