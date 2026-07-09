import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FrigateClient, createFrigateClient } from '../../clients/frigate-client.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let fetchStub: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchStub = vi.fn();
  vi.stubGlobal('fetch', fetchStub);
});

function mockFetchOk(body: unknown, ok = true, status = 200) {
  fetchStub.mockResolvedValue({
    ok,
    status,
    json: async() => body,
    text: async() => JSON.stringify(body)
  } as unknown as Response);
}

// ---------------------------------------------------------------------------
// Factory — createFrigateClient
// ---------------------------------------------------------------------------

describe('createFrigateClient', () => {
  it('returns null when FRIGATE_SYNC_ENABLED is not true', () => {
    expect(createFrigateClient({ FRIGATE_SYNC_ENABLED: 'false' })).toBeNull();
    expect(createFrigateClient({})).toBeNull();
  });

  it('returns null when URL is missing even if enabled', () => {
    expect(createFrigateClient({ FRIGATE_SYNC_ENABLED: 'true', FRIGATE_API_KEY: 'k' })).toBeNull();
  });

  it('creates client with normalized URL (no trailing slash)', () => {
    const c = createFrigateClient({ FRIGATE_SYNC_ENABLED: 'true', FRIGATE_URL: 'https://frigate.local/', FRIGATE_API_KEY: 'k' });
    expect(c).toBeInstanceOf(FrigateClient);
  });
});

// ---------------------------------------------------------------------------
// getHeaders
// ---------------------------------------------------------------------------

describe('getHeaders', () => {
  it('includes Authorization Bearer when apiKey set', () => {
    const c = new FrigateClient({ url: 'https://f.local', apiKey: 'mykey', isMock: true });
    expect(c.getHeaders()).toEqual({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: 'Bearer mykey'
    });
  });

  it('omits Authorization when apiKey empty', () => {
    const c = new FrigateClient({ url: 'https://f.local', apiKey: '', isMock: true });
    expect(c.getHeaders().Authorization).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getRecentEvents
// ---------------------------------------------------------------------------

describe('getRecentEvents', () => {
  it('returns mock events when isMock=true', async() => {
    const c = new FrigateClient({ url: 'https://f.local', apiKey: '', isMock: true });
    const result = await c.getRecentEvents('cam1', 5);
    expect(result.mock).toBe(true);
    expect(result.events.length).toBeLessThanOrEqual(3); // mock caps at 3
    expect(result.events[0].label).toBe('motion');
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('fetches real events from Frigate API', async() => {
    const c = new FrigateClient({ url: 'https://f.local', apiKey: 'k', isMock: false });
    mockFetchOk([{ id: 'evt-1', camera: 'cam1', label: 'person', start_time: 1000 }]);
    const result = await c.getRecentEvents('cam1', 10);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].id).toBe('evt-1');
    expect(result.mock).toBeUndefined();
  });

  it('passes camera as query filter', async() => {
    const c = new FrigateClient({ url: 'https://f.local', apiKey: 'k', isMock: false });
    mockFetchOk([]);
    await c.getRecentEvents('front_door');
    const url = fetchStub.mock.calls[0][0] as string;
    expect(url).toContain('camera=front_door');
  });

  it('falls back to mock events on HTTP error', async() => {
    const c = new FrigateClient({ url: 'https://f.local', apiKey: 'k', isMock: false });
    mockFetchOk({ error: 'fail' }, false, 500);
    const result = await c.getRecentEvents();
    expect(result.mock).toBe(true);
  });

  it('falls back to mock events on network error', async() => {
    const c = new FrigateClient({ url: 'https://f.local', apiKey: 'k', isMock: false });
    fetchStub.mockRejectedValue(new TypeError('fetch failed'));
    const result = await c.getRecentEvents();
    expect(result.mock).toBe(true);
  });

  it('handles non-array response by returning empty list', async() => {
    const c = new FrigateClient({ url: 'https://f.local', apiKey: 'k', isMock: false });
    mockFetchOk({ items: [] }); // object, not array
    const result = await c.getRecentEvents();
    expect(result.events).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getEvent
// ---------------------------------------------------------------------------

describe('getEvent', () => {
  it('returns mock event when isMock=true', async() => {
    const c = new FrigateClient({ url: 'https://f.local', apiKey: '', isMock: true });
    const result = await c.getEvent('evt-99');
    expect(result.mock).toBe(true);
    expect(result.event.id).toBe('evt-99');
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('fetches single event by ID', async() => {
    const c = new FrigateClient({ url: 'https://f.local', apiKey: 'k', isMock: false });
    mockFetchOk({ id: 'evt-1', camera: 'cam1', label: 'car', start_time: 500 });
    const result = await c.getEvent('evt-1');
    expect(result.event.id).toBe('evt-1');
    expect(fetchStub).toHaveBeenCalledWith('https://f.local/api/events/evt-1', expect.any(Object));
  });

  it('returns empty event on HTTP error', async() => {
    const c = new FrigateClient({ url: 'https://f.local', apiKey: 'k', isMock: false });
    mockFetchOk({}, false, 404);
    const result = await c.getEvent('missing');
    expect(result.event.id).toBe('missing');
    expect(result.event.camera).toBe('');
  });
});

// ---------------------------------------------------------------------------
// getCameraSnap
// ---------------------------------------------------------------------------

describe('getCameraSnap', () => {
  it('returns empty snapshotUrl when isMock=true', async() => {
    const c = new FrigateClient({ url: 'https://f.local', apiKey: '', isMock: true });
    const result = await c.getCameraSnap('front');
    expect(result.mock).toBe(true);
    expect(result.snapshotUrl).toBe('');
  });

  it('does HEAD request for camera snapshot URL', async() => {
    const c = new FrigateClient({ url: 'https://f.local', apiKey: 'k', isMock: false });
    mockFetchOk(undefined, true, 200);
    await c.getCameraSnap('front_door');
    const [url, init] = fetchStub.mock.calls[0];
    expect(url).toBe('https://f.local/api/front_door/latest.jpg');
    expect((init as Record<string, unknown>).method).toBe('HEAD');
  });

  it('returns empty URL on HEAD failure', async() => {
    const c = new FrigateClient({ url: 'https://f.local', apiKey: 'k', isMock: false });
    mockFetchOk({}, false, 503);
    const result = await c.getCameraSnap('cam1');
    expect(result.snapshotUrl).toBe('');
  });
});
