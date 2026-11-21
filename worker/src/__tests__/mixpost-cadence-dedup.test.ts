import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMixpostClient } from '../lib/mixpost-client';
import { autoPostDailySpecials } from '../tree/mixpost/auto-post-daily-specials';
import { autoPostNewPromotions } from '../tree/mixpost/auto-post-new-promotions';
import { autoPostWeeklyHighlights } from '../tree/mixpost/auto-post-weekly-highlights';

const fetchMock = vi.fn<typeof fetch>();
let db: DatabaseSync;

function environment() {
  return {
    MIXPOST_API_URL: 'https://mixpost.example.invalid',
    MIXPOST_API_TOKEN: 'test-token',
    MIXPOST_ACCOUNTS: '1',
    AURA_DB: {
      prepare(sql: string) {
        const stmt = db.prepare(sql);
        return {
          bind(...args: SQLInputValue[]) {
            return {
              all: async () => ({ results: stmt.all(...args) }),
              run: async () => ({ meta: { changes: Number(stmt.run(...args).changes) } }),
            };
          },
        };
      },
    },
  };
}

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE cron_runs (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, job_id TEXT NOT NULL,
      status TEXT NOT NULL, payload TEXT, started_at TEXT NOT NULL, completed_at TEXT, output TEXT, error TEXT);
    CREATE TABLE products (name TEXT, price INTEGER, is_available INTEGER, tenant_id TEXT);
    INSERT INTO products VALUES ('Coffee', 30000, 1, 'default'), ('Tea', 25000, 1, 'store-b');
    CREATE TABLE promotions (id TEXT, code TEXT PRIMARY KEY, percent INTEGER, is_active INTEGER, tenant_id TEXT);
    INSERT INTO promotions VALUES ('p1', 'PROMO', 10, 1, 'default');
  `);
  fetchMock.mockReset().mockImplementation(async () => Response.json({ id: 42 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  db.close();
});

const slots = [
  { name: 'daily specials', run: autoPostDailySpecials, at: '2026-01-05T00:00:00Z', outside: '2026-01-05T00:05:00Z' },
  { name: 'new promotions', run: autoPostNewPromotions, at: '2026-01-05T01:00:00Z', outside: '2026-01-05T00:55:00Z' },
  { name: 'weekly highlights', run: autoPostWeeklyHighlights, at: '2026-01-05T02:00:00Z', outside: '2026-01-06T02:00:00Z' },
];

describe.each(slots)('$name', ({ run, at, outside }) => {
  it('does not post outside its Vietnam-time window', async () => {
    vi.setSystemTime(new Date(outside));
    expect(await run(environment(), 'default')).toEqual({ posted: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts only once across repeated invocations in the same window', async () => {
    vi.setSystemTime(new Date(at));
    expect(await run(environment(), 'default')).toEqual({ posted: 1 });
    expect(await run(environment(), 'default')).toEqual({ posted: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(db.prepare('SELECT status, output FROM cron_runs').all()).toEqual([
      { status: 'completed', output: JSON.stringify({ postId: 42 }) },
    ]);
  });
});

it('allows only one concurrent claimant per tenant and period', async () => {
  vi.setSystemTime(new Date(slots[0].at));
  const results = await Promise.all([
    autoPostDailySpecials(environment(), 'default'),
    autoPostDailySpecials(environment(), 'default'),
  ]);
  expect(results.map(({ posted }) => posted).sort()).toEqual([0, 1]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(await autoPostDailySpecials(environment(), 'store-b')).toEqual({ posted: 1 });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it.each(['5xx', 'timeout', 'missing post ID'])('keeps the claim when Mixpost returns %s', async (failure) => {
  let statusAtRequest: unknown;
  fetchMock.mockImplementation(async () => {
    statusAtRequest = db.prepare('SELECT status FROM cron_runs').get();
    if (failure === 'timeout') throw new DOMException('Timed out', 'TimeoutError');
    if (failure === '5xx') return new Response('unavailable', { status: 503 });
    return Response.json({});
  });
  const now = new Date(slots[0].at);
  expect(await autoPostDailySpecials(environment(), 'default', now)).toEqual({ posted: 0 });
  expect(await autoPostDailySpecials(environment(), 'default', now)).toEqual({ posted: 0 });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(statusAtRequest).toEqual({ status: 'claimed' });
  expect(db.prepare('SELECT status FROM cron_runs').get()).toEqual({ status: 'unknown' });
});

it('deduplicates promotions across days but accepts a new promotion ID', async () => {
  expect(await autoPostNewPromotions(environment(), 'default', new Date(slots[1].at))).toEqual({ posted: 1 });
  db.exec("INSERT INTO promotions VALUES ('p2', 'NEW', 15, 1, 'default')");
  expect(await autoPostNewPromotions(environment(), 'default', new Date('2026-01-06T01:04:59Z'))).toEqual({ posted: 1 });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('posts a new promotion after fifty older active promotions were already posted', async () => {
  const insert = db.prepare('INSERT INTO promotions VALUES (?, ?, 10, 1, ?)');
  for (let i = 2; i <= 50; i++) insert.run(`p${i}`, `PROMO${i}`, 'default');
  expect(await autoPostNewPromotions(environment(), 'default', new Date(slots[1].at))).toEqual({ posted: 50 });

  insert.run('p51', 'NEW', 'default');
  fetchMock.mockClear();
  expect(await autoPostNewPromotions(environment(), 'default', new Date('2026-01-06T01:00:00Z'))).toEqual({ posted: 1 });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each([401, 403, 422])('retries a promotion after a definitive %s rejection is resolved', async (status) => {
  fetchMock.mockImplementationOnce(async () => new Response('rejected', { status }));
  expect(await autoPostNewPromotions(environment(), 'default', new Date(slots[1].at))).toEqual({ posted: 0 });
  expect(db.prepare('SELECT COUNT(*) AS count FROM cron_runs').get()).toEqual({ count: 0 });
  expect(await autoPostNewPromotions(environment(), 'default', new Date('2026-01-06T01:00:00Z'))).toEqual({ posted: 1 });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('uses the ISO week-year when a Monday falls in late December', async () => {
  expect(await autoPostWeeklyHighlights(environment(), 'default', new Date('2025-12-29T02:00:00Z'))).toEqual({ posted: 1 });
  expect(await autoPostWeeklyHighlights(environment(), 'default', new Date(slots[2].at))).toEqual({ posted: 1 });
  expect(db.prepare('SELECT payload FROM cron_runs ORDER BY started_at').all()).toEqual([
    { payload: JSON.stringify({ key: '2026-W01' }) },
    { payload: JSON.stringify({ key: '2026-W02' }) },
  ]);
});

it('does not retry POST createPost on a provider 5xx', async () => {
  fetchMock.mockImplementation(async () => new Response('unavailable', { status: 503 }));
  const client = createMixpostClient('https://mixpost.example.invalid', 'test-token', { retryDelay: 1 });
  await expect(client.createPost({ content: 'Coffee', accounts: [1] })).rejects.toMatchObject({ status: 503 });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
