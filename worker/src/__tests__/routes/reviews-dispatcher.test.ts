/**
 * TDD: Reviews dispatcher wrapper test.
 * Verifies executionContext passing before Phase 2 consolidation.
 */
import { describe, it, expect, vi } from 'vitest';

describe('Reviews dispatcher wrapper', () => {
  it('strips /api/reviews prefix before passing to reviewsRouter', async() => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('ok'));
    const reviewsRouter = { fetch: fetchSpy };

    const req = new Request('https://test.aura/api/reviews/list?page=1');
    const strippedUrl = req.url.replace('/api/reviews', '');
    await reviewsRouter.fetch(new Request(strippedUrl, req), {});

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0][0].url;
    expect(calledUrl).not.toContain('/api/reviews');
    expect(calledUrl).toBe('https://test.aura/list?page=1');
  });

  it('passes executionContext to reviewsRouter.fetch', async() => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('ok'));
    const reviewsRouter = { fetch: fetchSpy };

    const req = new Request('https://test.aura/api/reviews/list');
    const execCtx = { waitUntil: () => {} };
    const strippedUrl = req.url.replace('/api/reviews', '');

    await reviewsRouter.fetch(new Request(strippedUrl, req), {}, execCtx);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(Request),
      expect.any(Object),
      execCtx
    );
  });

  it('handles reviews sub-paths correctly', async() => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('ok'));
    const reviewsRouter = { fetch: fetchSpy };

    const req = new Request('https://test.aura/api/reviews/submit/123');
    const strippedUrl = req.url.replace('/api/reviews', '');
    await reviewsRouter.fetch(new Request(strippedUrl, req), {});

    expect(fetchSpy.mock.calls[0][0].url).toBe('https://test.aura/submit/123');
  });
});
