/**
 * Mixpost API Client — reusable HTTP client for Mixpost REST API
 *
 * Creates a client with methods for posts, media, and accounts.
 * Handles Bearer token auth, 5xx retry (once, 2s delay), and 401 warnings.
 *
 * Usage:
 *   import { createMixpostClient } from '../lib/mixpost-client';
 *   const mixpost = createMixpostClient(apiUrl, apiToken);
 *   const post = await mixpost.createPost({ accounts: [1], content: '...' });
 */

export class MixpostApiError extends Error {
  status: number;
  body: string;
  endpoint: string;

  constructor(status: number, body: string, endpoint: string) {
    super(`Mixpost API error: ${status} on ${endpoint}`);
    this.name = 'MixpostApiError';
    this.status = status;
    this.body = body;
    this.endpoint = endpoint;
  }
}

export interface MixpostCreatePostParams {
  accounts: number[];
  tags?: string[];
  date?: string;
  time?: string;
  content: string;
  scheduledAt?: string;
  mediaIds?: Array<string | number>;
}

export interface MixpostClientOptions {
  retryDelay?: number;
}

export interface MixpostClient {
  createPost(params: MixpostCreatePostParams): Promise<Record<string, unknown>>;
  uploadMediaFromUrl(imageUrl: string): Promise<Record<string, unknown>>;
  listAccounts(): Promise<Array<Record<string, unknown>>>;
  getAccount(id: number | string): Promise<Record<string, unknown>>;
  listPosts(): Promise<Array<Record<string, unknown>>>;
}

export function createMixpostClient(apiUrl: string, apiToken: string, options: MixpostClientOptions = {}): MixpostClient {
  const baseUrl = apiUrl.replace(/\/+$/, '');
  const retryDelay = options.retryDelay || 2000;

  async function request(method: string, endpoint: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const url = `${baseUrl}${endpoint}`;
    const opts: RequestInit & { headers: Record<string, string> } = {
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

    if (res.status === 401) {
      const text = await res.text();
      throw new MixpostApiError(401, text, endpoint);
    }

    if (res.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      res = await fetch(url, opts);
      if (res.status >= 500) {
        const text = await res.text();
        throw new MixpostApiError(res.status, text, endpoint);
      }
    }

    if (res.status < 200 || res.status >= 300) {
      const text = await res.text();
      throw new MixpostApiError(res.status, text, endpoint);
    }

    return res.json() as Promise<Record<string, unknown>>;
  }

  function parseScheduledAt(isoString: string): { date: string; time: string } {
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
    async createPost({ accounts, tags, date, time, content, scheduledAt, mediaIds }: MixpostCreatePostParams): Promise<Record<string, unknown>> {
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

      return request('POST', '/api/mixpost/posts', payload as unknown as Record<string, unknown>);
    },

    async uploadMediaFromUrl(imageUrl: string): Promise<Record<string, unknown>> {
      return request('POST', '/api/mixpost/media/download', { url: imageUrl });
    },

    async listAccounts(): Promise<Array<Record<string, unknown>>> {
      return request('GET', '/api/mixpost/accounts') as unknown as Promise<Array<Record<string, unknown>>>;
    },

    async getAccount(id: number | string): Promise<Record<string, unknown>> {
      return request('GET', `/api/mixpost/accounts/${id}`);
    },

    async listPosts(): Promise<Array<Record<string, unknown>>> {
      return request('GET', '/api/mixpost/posts') as unknown as Promise<Array<Record<string, unknown>>>;
    },
  };
}
