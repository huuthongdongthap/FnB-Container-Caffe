import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPretixClient } from '../../../tree/pretix/client-factory.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnv(overrides?: Record<string, unknown>) {
  return { PRETIX_API_URL: 'https://pretix.eu/api/v1', PRETIX_API_TOKEN: 'tok-123', ...overrides };
}

function stubFetch(status: number, body: Record<string, unknown>) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const original = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    async(_url: string | URL | Request, init?: RequestInit) => {
      const url = typeof _url === 'string' ? _url : _url.toString();
      const headers = (init as Record<string, unknown> | undefined)?.headers as Record<string, string> | undefined;
      calls.push({ url, headers: headers || {} });
      return {
        status,
        ok: status >= 200 && status < 300,
        json: async() => body,
        text: async() => JSON.stringify(body)
      } as Response;
    },
    { useOriginal: false }
  );
  return {
    getCalls: () => calls,
    cleanup: () => {
      vi.unstubAllGlobals();
      if (original) {
        vi.stubGlobal('fetch', original, { useOriginal: false });
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getPretixClient', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when API URL is missing', () => {
    const client = getPretixClient(makeEnv({ PRETIX_API_URL: undefined }));
    expect(client).toBeNull();
  });

  it('returns null when API token is missing', () => {
    const client = getPretixClient(makeEnv({ PRETIX_API_TOKEN: undefined }));
    expect(client).toBeNull();
  });

  it('returns null when both are missing', () => {
    const client = getPretixClient({} as Parameters<typeof getPretixClient>[0]);
    expect(client).toBeNull();
  });

  it('returns a non-null client when both env fields are present', () => {
    const client = getPretixClient(makeEnv());
    expect(client).not.toBeNull();
    expect(client!.listEvents).toBeDefined();
    expect(client!.redeemCheckin).toBeDefined();
  });

  it('strips trailing slash from API URL so endpoint paths are not doubled', async() => {
    const envURL = 'https://pretix.eu/api/v1/';
    const client = getPretixClient(makeEnv({ PRETIX_API_URL: envURL }));
    expect(client).not.toBeNull();

    const { getCalls, cleanup } = stubFetch(200, { results: [] });
    try {
      await client!.listEvents('myorg');
      const calls = getCalls();
      // URL should be /api/v1/organizers/myorg/events/ — no double-slash
      expect(calls[0].url).toContain('/organizers/myorg/events/');
      expect(calls[0].url).not.toContain('//organizers');
    } finally {
      cleanup();
    }
  });

  it('sends Token authorization header with the env token', async() => {
    const token = 'my-secret-token';
    const client = getPretixClient(makeEnv({ PRETIX_API_TOKEN: token }));
    const { getCalls, cleanup } = stubFetch(200, { results: [] });
    try {
      await client!.listEvents('myorg');
      expect(getCalls()[0].headers.Authorization).toBe(`Token ${token}`);
    } finally {
      cleanup();
    }
  });

  it('retries once on 5xx before throwing PretixApiError', async() => {
    const client = getPretixClient(makeEnv());
    let callCount = 0;
    vi.stubGlobal(
      'fetch',
      async() => {
        callCount++;
        if (callCount === 1) {
          return { status: 502, ok: false, json: async() => ({}), text: async() => 'Bad Gateway' } as Response;
        }
        return { status: 200, ok: true, json: async() => ({ id: 1 }), text: async() => '{"id":1}' } as Response;
      },
      { useOriginal: false }
    );

    const result = await client!.getEvent('myorg', 'evt-1');
    expect(result).toEqual({ id: 1 });
    expect(callCount).toBe(2);
    vi.unstubAllGlobals();
  });

  it('throws PretixApiError immediately on 401', async() => {
    const client = getPretixClient(makeEnv());
    vi.stubGlobal(
      'fetch',
      async() => {
        return { status: 401, ok: false, json: async() => ({}), text: async() => 'Unauthorized' } as Response;
      },
      { useOriginal: false }
    );

    await expect(client!.listEvents('myorg')).rejects.toThrow('401');
    vi.unstubAllGlobals();
  });

  it('resolves PretixEnv AURA_DB field without interfering with client creation', () => {
    const env = makeEnv({ AURA_DB: {} });
    const client = getPretixClient(env);
    expect(client).not.toBeNull();
  });
});
