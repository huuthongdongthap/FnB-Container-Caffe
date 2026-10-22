import { it, expect, vi, afterEach } from 'vitest';
import { consumeKdsStream } from '../kds-stream';

vi.mock('@/lib/api-client', () => ({ API_BASE: 'https://local.test' }));
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

it('uses Authorization and never puts a bearer credential in the stream URL', async () => {
  localStorage.setItem('aura_auth_token', 'private-staff-token');
  const controller = new AbortController();
  const snapshot = vi.fn(() => controller.abort());
  const fetchMock = vi.fn(async () => new Response(new ReadableStream({
    start(stream) {
      const encoder = new TextEncoder();
      stream.enqueue(encoder.encode('event: snapshot\ndata: [{"id":"ORD_'));
      stream.enqueue(encoder.encode('1"}]\n\n'));
      stream.close();
    },
  }), { headers: { 'Content-Type': 'text/event-stream' } }));
  vi.stubGlobal('fetch', fetchMock);
  await consumeKdsStream(controller.signal, snapshot);
  expect(fetchMock).toHaveBeenCalledWith('https://local.test/api/kds/orders/stream', expect.objectContaining({
    headers: { Accept: 'text/event-stream', Authorization: 'Bearer private-staff-token' }, credentials: 'include',
  }));
  expect(snapshot).toHaveBeenCalledExactlyOnceWith([{ id: 'ORD_1' }]);
});

it('stops after an unauthorized response rather than retrying or publishing a snapshot', async () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 401 }));
  vi.stubGlobal('fetch', fetchMock);
  const snapshot = vi.fn();
  await consumeKdsStream(new AbortController().signal, snapshot);
  expect(fetchMock).toHaveBeenCalledTimes(1); expect(snapshot).not.toHaveBeenCalled();
});
