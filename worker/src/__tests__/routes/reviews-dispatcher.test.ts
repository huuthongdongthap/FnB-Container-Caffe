/**
 * TDD: Reviews dispatcher wrapper test.
 * Verifies executionContext passing before Phase 2 consolidation.
 */
import { describe, it, expect, vi } from 'vitest';
import { reviewsRouter as realReviewsRouter } from '../../routes/reviews';
import { createMockEnv } from '../test-utils';

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

  it('rejects invalid review rating on real reviewsRouter', async() => {
    const env = createMockEnv();
    const res = await realReviewsRouter.fetch(
      new Request('https://test.aura/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: 'ORD_1', rating: 99 }),
      }),
      env
    );
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(false);
  });
});
