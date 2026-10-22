import { API_BASE } from '@/lib/api-client';
import { AUTH_TOKEN_KEY } from './stores/use-auth-store';

/** Authenticated streaming fetch keeps the bearer token out of request URLs. */
export async function consumeKdsStream(signal: AbortSignal, snapshot: (orders: unknown[]) => void) {
  while (!signal.aborted) {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      const response = await fetch(`${API_BASE}/api/kds/orders/stream`, {
        credentials: 'include', signal,
        headers: { Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (response.status === 401 || response.status === 403) return;
      if (!response.ok || !response.body) throw new Error('KDS stream unavailable');
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!signal.aborted) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, '\n');
        let end;
        while ((end = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (!/^event:\s*snapshot$/m.test(frame)) continue;
          try {
            const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
            const orders: unknown = JSON.parse(data);
            if (Array.isArray(orders) && !signal.aborted) snapshot(orders);
          } catch { /* Ignore malformed frames; REST polling remains authoritative. */ }
        }
      }
    } catch {
      if (signal.aborted) return;
    } finally {
      await reader?.cancel().catch(() => {});
    }
    if (signal.aborted) return;
    await new Promise<void>(resolve => {
      const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
      const timer = setTimeout(done, 3_000);
      signal.addEventListener('abort', done, { once: true });
    });
  }
}
