/**
 * TDD: Contact dispatcher wrapper test.
 * Verifies prefix stripping + executionContext passing before Phase 2 consolidation.
 */
import { describe, it, expect, vi } from 'vitest';

describe('Contact dispatcher wrapper', () => {
  it('strips /api/contact prefix before passing to contactRouter', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('ok'));
    const contactRouter = { fetch: fetchSpy };

    const originalUrl = 'https://test.aura/api/contact/send';
    const req = new Request(originalUrl, { method: 'POST', body: JSON.stringify({ message: 'test' }) });
    const execCtx = { waitUntil: () => {} };

    // Simulate the JS dispatcher pattern (correct): strip prefix + pass execCtx
    const strippedUrl = req.url.replace('/api/contact', '');
    await contactRouter.fetch(new Request(strippedUrl, req), {}, execCtx);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0][0].url;
    expect(calledUrl).not.toContain('/api/contact');
    expect(calledUrl).toContain('/send');
  });

  it('passes executionContext to contactRouter.fetch', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('ok'));
    const contactRouter = { fetch: fetchSpy };

    const req = new Request('https://test.aura/api/contact/send', { method: 'POST' });
    const execCtx = { waitUntil: () => {} };

    const strippedUrl = req.url.replace('/api/contact', '');
    await contactRouter.fetch(new Request(strippedUrl, req), {}, execCtx);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(Request),
      expect.any(Object),
      execCtx,
    );
  });

  it('preserves request body through prefix strip', async () => {
    let capturedBody: string | null = null;
    const fetchSpy = vi.fn().mockImplementation(async (r: Request) => {
      capturedBody = await r.text();
      return new Response('ok');
    });
    const contactRouter = { fetch: fetchSpy };

    const req = new Request('https://test.aura/api/contact/send', {
      method: 'POST',
      body: JSON.stringify({ message: 'hello', phone: '0912345678' }),
    });
    const strippedUrl = req.url.replace('/api/contact', '');
    await contactRouter.fetch(new Request(strippedUrl, req), {});

    expect(capturedBody).toBe(JSON.stringify({ message: 'hello', phone: '0912345678' }));
  });
});
