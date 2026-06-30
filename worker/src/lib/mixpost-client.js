/**
 * Mixpost API Client — reusable HTTP client for Mixpost REST API
 *
 * Creates a client with methods for posts, media, and accounts.
 * Handles Bearer token auth, 5xx retry (once, 2s delay), and 401 warnings.
 *
 * Usage:
 *   import { createMixpostClient } from '../lib/mixpost-client.js';
 *   const mixpost = createMixpostClient(apiUrl, apiToken);
 *   const post = await mixpost.createPost({ accounts: [1], content: '...' });
 */

/**
 * Custom error class for Mixpost API failures.
 * Carries HTTP status, response body, and the endpoint that failed.
 */
export class MixpostApiError extends Error {
  constructor(status, body, endpoint) {
    super(`Mixpost API error: ${status} on ${endpoint}`);
    this.name = 'MixpostApiError';
    this.status = status;
    this.body = body;
    this.endpoint = endpoint;
  }
}

/**
 * Create a Mixpost API client.
 *
 * @param {string} apiUrl - Base URL of Mixpost (e.g., http://mixpost.local:9000)
 * @param {string} apiToken - Bearer token for Mixpost API auth
 * @param {{ retryDelay?: number }} [options] - Optional overrides (e.g., retryDelay for testing)
 * @returns {{ createPost: Function, uploadMediaFromUrl: Function, listAccounts: Function, getAccount: Function, listPosts: Function }}
 */
export function createMixpostClient(apiUrl, apiToken, options = {}) {
  const baseUrl = apiUrl.replace(/\/+$/, '');
  const retryDelay = options.retryDelay || 2000;

  /**
   * Internal request helper.
   * Sets auth headers, retries 5xx once with a delay, throws MixpostApiError on failure.
   */
  async function request(method, endpoint, body) {
    const url = `${baseUrl}${endpoint}`;
    const opts = {
      method,
      headers: {
        Authorization: `Bearer ${apiToken}`,
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
      throw new MixpostApiError(401, text, endpoint);
    }

    // 5xx: retry once after delay
    if (res.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      res = await fetch(url, opts);
      if (res.status >= 500) {
        const text = await res.text();
        throw new MixpostApiError(res.status, text, endpoint);
      }
    }

    // Non-2xx status that isn't 401 or 5xx
    if (res.status < 200 || res.status >= 300) {
      const text = await res.text();
      throw new MixpostApiError(res.status, text, endpoint);
    }

    return res.json();
  }

  /**
   * Parse an ISO datetime string into { date: 'YYYY-MM-DD', time: 'HH:MM' }.
   */
  function parseScheduledAt(isoString) {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid scheduledAt datetime: ${isoString}`);
    }
    const date = d.toISOString().split('T')[0];
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return { date, time: `${hours}:${minutes}` };
  }

  return {
    /**
     * Create a scheduled post in Mixpost.
     *
     * @param {{ accounts: number[], tags?: string[], date?: string, time?: string, content: string, scheduledAt?: string }} params
     * @returns {Promise<object>} Mixpost API response
     */
    async createPost({ accounts, tags, date, time, content, scheduledAt, mediaIds }) {
      // If scheduledAt is provided without explicit date/time, parse it
      let postDate = date;
      let postTime = time;
      if (scheduledAt && !date && !time) {
        const parsed = parseScheduledAt(scheduledAt);
        postDate = parsed.date;
        postTime = parsed.time;
      }

      const payload = {
        accounts,
        tags: tags || [],
        date: postDate || new Date().toISOString().split('T')[0],
        time: postTime || '09:00',
        versions: [
          {
            is_original: true,
            account_id: null,
            content: [{ body: content, media: (mediaIds || []).map(id => ({ id })) }],
          },
        ],
      };

      return request('POST', '/api/mixpost/posts', payload);
    },

    /**
     * Upload media to Mixpost from a URL.
     *
     * @param {string} imageUrl - Public URL of the image to download
     * @returns {Promise<object>} Mixpost media response (includes id)
     */
    async uploadMediaFromUrl(imageUrl) {
      return request('POST', '/api/mixpost/media/download', { url: imageUrl });
    },

    /**
     * List all connected social accounts in Mixpost.
     *
     * @returns {Promise<Array>} Array of account objects
     */
    async listAccounts() {
      return request('GET', '/api/mixpost/accounts');
    },

    /**
     * Get a single Mixpost account by ID.
     *
     * @param {number|string} id - Account ID
     * @returns {Promise<object>} Account object
     */
    async getAccount(id) {
      return request('GET', `/api/mixpost/accounts/${id}`);
    },

    /**
     * List recent posts from Mixpost.
     *
     * @returns {Promise<Array>} Array of post objects
     */
    async listPosts() {
      return request('GET', '/api/mixpost/posts');
    },
  };
}
