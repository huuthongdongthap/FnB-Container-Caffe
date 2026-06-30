/**
 * pretix API Client — reusable HTTP client for pretix REST API
 *
 * Creates a client with methods for events, orders, checkin, and webhooks.
 * Handles Token auth, 5xx retry (once, configurable delay), and 401 errors.
 *
 * Usage:
 *   import { createPretixClient } from '../lib/pretix-client.js';
 *   const pretix = createPretixClient(apiUrl, apiToken);
 *   const events = await pretix.listEvents('aura-cafe');
 */

/**
 * Custom error class for pretix API failures.
 * Carries HTTP status, response body, and the endpoint that failed.
 */
export class PretixApiError extends Error {
  constructor(status, body, endpoint) {
    super(`pretix API error: ${status} on ${endpoint}`);
    this.name = 'PretixApiError';
    this.status = status;
    this.body = body;
    this.endpoint = endpoint;
  }
}

/**
 * Create a pretix API client.
 *
 * @param {string} apiUrl - Base URL of pretix (e.g., https://tickets.auraspace.cafe)
 * @param {string} apiToken - API token for pretix auth
 * @param {{ retryDelay?: number }} [options] - Optional overrides (e.g., retryDelay for testing)
 * @returns {{ listEvents: Function, getEvent: Function, listOrders: Function, getOrder: Function, redeemCheckin: Function, listWebhooks: Function, createWebhook: Function }}
 */
export function createPretixClient(apiUrl, apiToken, options = {}) {
  const baseUrl = apiUrl.replace(/\/+$/, '');
  const retryDelay = options.retryDelay || 2000;

  /**
   * Internal request helper.
   * Sets Token auth headers, retries 5xx once with a delay, throws PretixApiError on failure.
   */
  async function request(method, endpoint, body) {
    const url = `${baseUrl}${endpoint}`;
    const opts = {
      method,
      headers: {
        Authorization: `Token ${apiToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }

    let res = await fetch(url, opts);

    // 401: token likely expired — throw immediately, no retry
    if (res.status === 401) {
      const text = await res.text();
      throw new PretixApiError(401, text, endpoint);
    }

    // 5xx: retry once after delay
    if (res.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      res = await fetch(url, opts);
      if (res.status >= 500) {
        const text = await res.text();
        throw new PretixApiError(res.status, text, endpoint);
      }
    }

    // Non-2xx status that isn't 401 or 5xx
    if (res.status < 200 || res.status >= 300) {
      const text = await res.text();
      throw new PretixApiError(res.status, text, endpoint);
    }

    // Parse JSON safely — pretix may return non-JSON on proxy errors
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new PretixApiError(res.status, text, endpoint);
    }
  }

  return {
    /**
     * List all events for an organizer.
     * @param {string} organizer - Organizer slug
     * @returns {Promise<object>} Paginated events response
     */
    async listEvents(organizer) {
      return request('GET', `/api/v1/organizers/${organizer}/events/`);
    },

    /**
     * Get a single event by slug.
     * @param {string} organizer - Organizer slug
     * @param {string} eventSlug - Event slug
     * @returns {Promise<object>} Event object with items
     */
    async getEvent(organizer, eventSlug) {
      return request('GET', `/api/v1/organizers/${organizer}/events/${eventSlug}/`);
    },

    /**
     * Create a new event.
     * @param {string} organizer - Organizer slug
     * @param {object} data - Event data
     * @returns {Promise<object>} Created event
     */
    async createEvent(organizer, data) {
      return request('POST', `/api/v1/organizers/${organizer}/events/`, data);
    },

    /**
     * List ticket types (items) for an event.
     * @param {string} organizer - Organizer slug
     * @param {string} eventSlug - Event slug
     * @returns {Promise<object>} Paginated items response
     */
    async listItems(organizer, eventSlug) {
      return request('GET', `/api/v1/organizers/${organizer}/events/${eventSlug}/items/`);
    },

    /**
     * Get a single item (ticket type).
     * @param {string} organizer - Organizer slug
     * @param {string} eventSlug - Event slug
     * @param {number} itemId - Item ID
     * @returns {Promise<object>} Item object
     */
    async getItem(organizer, eventSlug, itemId) {
      return request('GET', `/api/v1/organizers/${organizer}/events/${eventSlug}/items/${itemId}/`);
    },

    /**
     * List orders for an event.
     * @param {string} organizer - Organizer slug
     * @param {string} eventSlug - Event slug
     * @returns {Promise<object>} Paginated orders response
     */
    async listOrders(organizer, eventSlug) {
      return request('GET', `/api/v1/organizers/${organizer}/events/${eventSlug}/orders/`);
    },

    /**
     * Get a single order by code.
     * @param {string} organizer - Organizer slug
     * @param {string} eventSlug - Event slug
     * @param {string} code - Order code
     * @returns {Promise<object>} Order object
     */
    async getOrder(organizer, eventSlug, code) {
      return request('GET', `/api/v1/organizers/${organizer}/events/${eventSlug}/orders/${code}/`);
    },

    /**
     * Redeem (check in) a ticket via its secret.
     * @param {string} organizer - Organizer slug
     * @param {string} eventSlug - Event slug
     * @param {number} listId - Check-in list ID
     * @param {string} secret - Ticket secret (from QR code scan)
     * @returns {Promise<object>} Check-in result
     */
    async redeemCheckin(organizer, eventSlug, listId, secret) {
      return request(
        'POST',
        `/api/v1/organizers/${organizer}/events/${eventSlug}/checkinlists/${listId}/positions/${secret}/redeem/?untrusted_input=true`
      );
    },

    /**
     * List webhooks for an organizer.
     * @param {string} organizer - Organizer slug
     * @returns {Promise<object>} Paginated webhooks response
     */
    async listWebhooks(organizer) {
      return request('GET', `/api/v1/organizers/${organizer}/webhooks/`);
    },

    /**
     * Create a webhook for an organizer.
     * @param {string} organizer - Organizer slug
     * @param {object} data - Webhook config (target_url, action_types, all_events, enabled)
     * @returns {Promise<object>} Created webhook
     */
    async createWebhook(organizer, data) {
      return request('POST', `/api/v1/organizers/${organizer}/webhooks/`, data);
    },
  };
}
