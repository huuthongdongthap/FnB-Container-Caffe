// @vitest-environment node
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function worker(filename = 'sw-mobile.js') {
  const listeners = new Map<string, (event: any) => void>();
  const network = vi.fn().mockResolvedValue(new Response('network'));
  const caches = { match: vi.fn().mockResolvedValue(new Response('old-private-response')),
    open: vi.fn(), keys: vi.fn().mockResolvedValue(['aura-mobile-v1', 'aura-mobile-v2']), delete: vi.fn().mockResolvedValue(true) };
  vm.runInNewContext(readFileSync(new URL(`../public/${filename}`, import.meta.url), 'utf8'), {
    self: { location: { origin: 'http://local.test' }, addEventListener: (type: string, handler: (event: any) => void) => listeners.set(type, handler), skipWaiting() {}, clients: { claim() {} } },
    fetch: network, caches, URL, Promise,
  });
  return { listeners, network, caches };
}
describe('legacy mobile service worker session isolation', () => {
  it.each(['/mobile/me', '/mobile/orders', '/private.json'])('main worker also bypasses private/mobile caching at %s', async path => {
    const f = worker('sw.js');
    f.network.mockRejectedValue(new Error('offline'));
    let response!: Promise<Response>;
    f.listeners.get('fetch')!({ request: new Request(`http://local.test${path}`, {
      headers: path === '/private.json' ? { Authorization: 'Bearer old-user' } : {},
    }), respondWith: (p: Promise<Response>) => { response = p; } });
    await expect(response).rejects.toThrow('offline');
    expect(f.caches.match).not.toHaveBeenCalled();
    expect(f.caches.open).not.toHaveBeenCalled();
  });
  it.each(['/api/orders', '/mobile/me', '/mobile/login', '/mobile/refresh', '/mobile/api/orders'])('never caches or replays private response at %s', async path => {
    const f = worker();
    f.network.mockRejectedValue(new Error('offline'));
    let response!: Promise<Response>;
    f.listeners.get('fetch')!({ request: new Request(`http://local.test${path}`), respondWith: (p: Promise<Response>) => { response = p; } });
    await expect(response).rejects.toThrow('offline');
    expect(f.caches.match).not.toHaveBeenCalled();
    expect(f.caches.open).not.toHaveBeenCalled();
  });
  it('purges the old version during activation', async () => {
    const f = worker(); let complete!: Promise<unknown>;
    f.listeners.get('activate')!({ waitUntil: (p: Promise<unknown>) => { complete = p; } });
    await complete;
    expect(f.caches.delete).toHaveBeenCalledWith('aura-mobile-v1');
    expect(f.caches.delete).not.toHaveBeenCalledWith('aura-mobile-v2');
  });
});
