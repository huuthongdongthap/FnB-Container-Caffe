/**
 * Integration tests for DinDin worker routes (dindinRouter).
 *
 * Auth bypass: vi.mock('../../middleware/auth', ...) replaces requireAuth with a
 * pass-through middleware.  Vitest hoists the call so the replacement is active
 * before dindin.ts imports from that module.
 */

import { describe, it, expect, vi } from 'vitest';

// ── Auth bypass ──────────────────────────────────────────────────
// (_c, next) => next() calls next() so Hono 4 finalises the context and the
// route handler runs normally (empty response would cause "Context is not finalised").
vi.mock('../../middleware/auth', () => ({
  requireAuth: () => (_c: any, next: any) => next()
}));

import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { dindinRouter, dindinCheckoutSchema } from '../../routes/dindin';

// ══════════════════════════════════════════════════════════════════
//  Test helpers
// ══════════════════════════════════════════════════════════════════

const TEST_CFG = {
  menu: { sections: [{ items: [{ name: 'AA', price: 30000, id: '1', stock: 10, sold_out: false }] }] },
  settings: {}
};
/** Menu used for stock-exceeded tests */
const STOCK_MENU = {
  menu: { sections: [{ items: [{ name: 'AA', price: 30000, id: '1', stock: 1, sold_out: false }] }] },
  settings: {}
};

function cfgBlob(v: unknown = TEST_CFG): string {
  return JSON.stringify(v);
}

/** In-memory KV */
function mkKV(init: Record<string, unknown> = {}): KVNamespace {
  const store = new Map<string, string>();
  for (const [k, v] of Object.entries(init)) {
    store.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  return {
    async get(_key: string) {
      return store.get(_key) ?? null;
    },
    async put(key: string, value: unknown) {
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list(prefix?: string) {
      return {
        keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((k) => ({ name: k })),
        cursor: '', list_complete: true
      };
    }
  } as any;
}

/**
 * mkDB(rows) — each entry supplies the result for one sequential `.prepare()` call.
 *   rows[i].first  → value returned by `.bind().first()`  (default: null)
 *   rows[i].run    → value returned by `.bind().run()`      (default: { success, changes: 1 })
 *   rows[i].all    → value returned by `.bind().all()`      (default: { results: [] })
 * Extra calls beyond rows.length return the final entry (or defaults).
 */
function mkDB(rows: Array<{ first?: () => Promise<any>; run?: () => Promise<any>; all?: () => Promise<any> }> = []) {
  let qi = 0;
  const last = rows[rows.length - 1];
  const defFirst = last?.first ?? (async() => null);
  const defRun = last?.run ?? (async() => ({ success: true, changes: 1 }));
  const defAll = last?.all ?? (async() => ({ results: [] }));

  // Each prepare() gets its own statement capturing the row at that index.
  // This mirrors real D1 where stmt.first() and stmt.bind().first() return
  // the same row data when 0 params are passed.
  const makeStmt = (idx: number) => {
    const r = rows[idx] ?? {};
    const rFirst = r.first ?? defFirst;
    const rRun = r.run ?? defRun;
    const rAll = r.all ?? defAll;
    const bound = {
      async first() {
        return rFirst();
      },
      async run() {
        return rRun();
      },
      async all() {
        return rAll();
      }
    };
    return {
      bind: () => bound,
      async first() {
        return rFirst();
      },
      async run() {
        return rRun();
      },
      async all() {
        return rAll();
      }
    };
  };

  const prep = () => {
    const i = Math.min(qi++, rows.length - 1);
    return makeStmt(i);
  };

  const nextRow = () => {
    const i = Math.min(qi++, rows.length - 1);
    return rows[i] ?? {};
  };
  return {
    prepare: prep,
    batch: async() => [],
    all: async() => ({ results: [] }),
    first: async() => null,
    run: async() => ({ success: true, changes: 1 }),
    async queryFirst(_sql: string, ..._params: any[]) {
      const r = nextRow();
      return r.first !== undefined ? await r.first() : await defFirst();
    },
    async execute(_sql: string, ..._params: any[]) {
      const r = nextRow();
      return r.run !== undefined ? await r.run() : await defRun();
    },
    async queryAll(_sql: string, ..._params: any[]) {
      const r = nextRow();
      return r.all !== undefined ? await r.all() : await defAll();
    }
  } as any;
}

function makeEnv(db?: any, kv?: any): Env {
  return {
    AURA_DB: db ?? mkDB(),
    AUTH_KV: kv ?? mkKV(),
    JWT_SECRET: 'test',
    JWT_EXPIRY_SECONDS: '86400',
    RESET_KEY: 'test',
    PAYOS_API_KEY: 'x',
    PAYOS_CLIENT_ID: 'x',
    PAYOS_CLIENT_SECRET: 'x'
  } as any;
}

/** Build a minimal Request targeting the (unmounted) dindinRouter. */
function req(method: string, url: string, body?: unknown): Request {
  return new Request(`https://aura.test${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body)
  });
}

function cartKey(id: string) {
  return `dindin:cart:${id}`;
}
function sheetKey(id: string) {
  return `dindin:sheets:${id}`;
}

// ══════════════════════════════════════════════════════════════════
//  Tests
// ══════════════════════════════════════════════════════════════════

describe('dindinRouter', () => {
  // ── GET /config ─────────────────────────────────────────────────

  describe('GET /config', () => {
    it('returns empty menu+sections when config row absent', async() => {
      const res = await dindinRouter.fetch(req('GET', '/config'), makeEnv());
      expect(res.status).toBe(200);
      const body = await (res.json() as Promise<any>);
      expect(body).toBeDefined();
      expect(body.success).toBe(true);
      expect(body.data.menu.sections).toEqual([]);
    });

    it('returns parsed menu + settings', async() => {
      const db = mkDB([{ first: async() => ({ config: cfgBlob() }) }]);
      const res = await dindinRouter.fetch(req('GET', '/config'), makeEnv(db));
      const body = await (res.json() as Promise<any>);
      expect(body).toBeDefined();
      expect(res.status).toBe(200);
      expect(body.data.menu.sections).toHaveLength(1);
      expect(body.data.settings).toBeDefined();
    });

    it('D06 (500) — DB throws', async() => {
      const db = mkDB([{ first: async() => {
        throw new Error('DB down');
      } }]);
      const res = await dindinRouter.fetch(req('GET', '/config'), makeEnv(db));
      expect(res.status).toBe(500);
      expect(((await res.json()) as any).code).toBe('D06');
    });

    it('D07 (400) — corrupt JSON in DB', async() => {
      const db = mkDB([{ first: async() => ({ config: 'not-json{{{' }) }]);
      const res = await dindinRouter.fetch(req('GET', '/config'), makeEnv(db));
      expect(res.status).toBe(400);
      expect(((await res.json()) as any).code).toBe('D07');
    });
  });

  // ── PUT /config ─────────────────────────────────────────────────

  describe('PUT /config', () => {
    it('D07 (400) — missing menu.sections', async() => {
      const db = mkDB([{ first: async() => null, run: async() => ({ success: true, changes: 1 }) }]);
      const res = await dindinRouter.fetch(req('PUT', '/config', { settings: {} }), makeEnv(db));
      expect(res.status).toBe(400);
      expect(((await res.json()) as any).code).toBe('D07');
    });

    it('D07 (400) — item missing name', async() => {
      const db = mkDB([{ first: async() => null, run: async() => ({ success: true, changes: 1 }) }]);
      const res = await dindinRouter.fetch(
        req('PUT', '/config', { menu: { sections: [{ items: [{ price: 100 }] }] } }),
        makeEnv(db)
      );
      expect(res.status).toBe(400);
      expect(((await res.json()) as any).code).toBe('D07');
    });

    it('200 — valid write', async() => {
      const db = mkDB([
        { first: async() => null },
        { run: async() => ({ success: true, changes: 1 }) }
      ]);
      const res = await dindinRouter.fetch(
        req('PUT', '/config', {
          menu: { sections: [{ name: 'Tea', items: [{ name: 'Green Tea', price: 30000 }] }] },
          settings: {}
        }),
        makeEnv(db)
      );
      expect(res.status).toBe(200);
      expect(((await res.json()) as any).success).toBe(true);
    });
  });

  // ── GET /cart/:sessionId ──────────────────────────────────────

  describe('GET /cart/:sessionId', () => {
    it('returns empty cart when nothing stored', async() => {
      const res = await dindinRouter.fetch(req('GET', '/cart/abc'), makeEnv());
      expect(res.status).toBe(200);
      expect(((await res.json()) as any).data.items).toEqual([]);
    });

    it('returns cart from KV', async() => {
      const kv = mkKV({ [cartKey('k1')]: JSON.stringify({ items: [{ name: 'Espresso', price: 35000, qty: 2 }], total: 70000 }) });
      const res = await dindinRouter.fetch(req('GET', '/cart/k1'), makeEnv(mkDB(), kv));
      expect(res.status).toBe(200);
      const body = await (res.json() as Promise<any>);
      expect(body.data.items[0].name).toBe('Espresso');
    });

    it('falls back to D1 when KV empty', async() => {
      const db = mkDB([{ first: async() => ({ raw: JSON.stringify({ items: [{ name: 'X', qty: 1 }], total: 10000 }) }) }]);
      const res = await dindinRouter.fetch(req('GET', '/cart/d1'), makeEnv(db));
      expect(res.status).toBe(200);
      expect(((await res.json()) as any).data.items).toHaveLength(1);
    });
  });

  // ── PATCH /cart/:sessionId ───────────────────────────────────

  describe('PATCH /cart/:sessionId', () => {
    it('D07 (400) — unknown action', async() => {
      const res = await dindinRouter.fetch(req('PATCH', '/cart/s1', { action: 'bad', item: {} }), makeEnv());
      expect(res.status).toBe(400);
      expect(((await res.json()) as any).code).toBe('D07');
    });

    it('D01 (400) — update without item.id', async() => {
      const res = await dindinRouter.fetch(req('PATCH', '/cart/s1', { action: 'update', item: {} }), makeEnv());
      expect(res.status).toBe(400);
      expect(((await res.json()) as any).code).toBe('D01');
    });

    it('add — 200', async() => {
      const res = await dindinRouter.fetch(
        req('PATCH', '/cart/s1', { action: 'add', item: { name: 'Espresso', price: 35000, qty: 2 } }),
        makeEnv()
      );
      expect(res.status).toBe(200);
      expect(((await res.json()) as any).data.total).toBe(70000);
    });

    it('remove — 200', async() => {
      const kv = mkKV({ [cartKey('r1')]: JSON.stringify({ items: [{ id: 'a', name: 'A', price: 20000, qty: 1 }, { id: 'b', name: 'B', price: 30000, qty: 1 }], total: 50000 }) });
      const res = await dindinRouter.fetch(req('PATCH', '/cart/r1', { action: 'remove', item: { id: 'a' } }), makeEnv(mkDB(), kv));
      expect(res.status).toBe(200);
      const rmBody = await (res.json() as Promise<any>);
      expect(rmBody.data.items).toHaveLength(1);
      expect(rmBody.data.total).toBe(30000);
    });

    it('clear — subsequent GET returns empty', async() => {
      const kv = mkKV({ [cartKey('c1')]: JSON.stringify({ items: [{ id: 'x', name: 'X', price: 1000, qty: 1 }], total: 1000 }) });
      await dindinRouter.fetch(req('PATCH', '/cart/c1', { action: 'remove', item: { id: 'x' } }), makeEnv(mkDB(), kv));
      const res = await dindinRouter.fetch(req('GET', '/cart/c1'), makeEnv(mkDB(), kv));
      expect(((await res.json()) as any).data.items).toHaveLength(0);
    });
  });

  // ── POST /checkout ───────────────────────────────────────────

  describe('POST /checkout', () => {
    /**
     * DB call sequence inside checkout:
     *   1. readCartRD → queryFirst(dindin_cart WHERE session_id = ?)   [KV fallback]
     *   2. queryFirst(dindin_config LIMIT 1)                           [menu]
     *   3. kvGet(dindin:idempotency:<key>)                             [idempotency]
     *   4. execute(INSERT INTO orders ...)                              [create order]
     *   5. writeCart → execute(upsert dindin_cart)                     [clear cart]
     */
    it('D03 (400) — schema validation (missing payment_method)', async() => {
      const db = mkDB([{ first: async() => null, run: async() => ({ success: true, changes: 1 }) }]);
      const res = await dindinRouter.fetch(req('POST', '/checkout', { sessionId: 's1' }), makeEnv(db));
      expect(res.status).toBe(400);
      expect(((await res.json()) as any).code).toBe('D03');
    });

    it('D01 (400) — empty cart or expired session', async() => {
      // Production code returns D01 when cart is null/empty after readCartRD
      const db = mkDB([{ first: async() => null }]); // D1 cart query → null (KV empty, no D1 row)
      const kv = mkKV(); // empty — no cart stored
      const res = await dindinRouter.fetch(req('POST', '/checkout', { sessionId: 'empty', payment_method: 'cod' }), makeEnv(db, kv));
      expect(res.status).toBe(400);
      expect(((await res.json()) as any).code).toBe('D01');
    });

    it('D02 (422) — price drift > 10%', async() => {
      // Cart from D1 (readCartRD: KV empty → D1 fallback)
      // Row sequence: D1-cart(0) → config(1) → idempotency(2) → insert(3) → clear(4)
      const db = mkDB([
        { first: async() => ({ raw: JSON.stringify({ items: [{ id: '1', name: 'AA', price: 90000, qty: 1 }], total: 90000 }) }) }, // D1 cart
        { first: async() => ({ config: cfgBlob() }) }, // menu config
        { first: async() => null }, // idempotency
        { run: async() => ({ success: true, changes: 1 }) } // INSERT order (not reached — early return D02)
      ]);
      const res = await dindinRouter.fetch(req('POST', '/checkout', { sessionId: 's1', payment_method: 'cod' }), makeEnv(db));
      expect(res.status).toBe(422);
      expect(((await res.json()) as any).code).toBe('D02');
    });

    it('D04 (409) — item sold out', async() => {
      const soldMenu = {
        menu: {
          sections: [{ items: [{ name: 'AA', price: 30000, id: '1', sold_out: true }] }]
        }
      };
      // Cart from D1 (KV empty)
      // Row sequence: D1-cart(0) → sold-out config(1) → idempotency(2) → early return D04
      const db = mkDB([
        { first: async() => ({ raw: JSON.stringify({ items: [{ id: '1', name: 'AA', price: 30000, qty: 1 }], total: 30000 }) }) }, // D1 cart
        { first: async() => ({ config: cfgBlob(soldMenu) }) }, // sold-out config
        { first: async() => null } // idempotency
      ]);
      const res = await dindinRouter.fetch(req('POST', '/checkout', { sessionId: 's1', payment_method: 'cod' }), makeEnv(db));
      expect(res.status).toBe(409);
      expect(((await res.json()) as any).code).toBe('D04');
    });

    it('200 — order created, cart cleared', async() => {
      // Cart in KV → readCartRD returns it from KV, D1 cart query skipped
      // Row sequence: [0]=config, [1]=idempotency, [2]=INSERT, [3]=clear
      const db = mkDB([
        { first: async() => ({ config: cfgBlob() }) },
        { first: async() => null },
        { run: async() => ({ success: true, changes: 1 }) },
        { run: async() => ({ success: true, changes: 1 }) }
      ]);
      const kv = mkKV({
        [cartKey('ok')]: JSON.stringify({
          items: [{ id: '1', name: 'AA', price: 30000, qty: 2 }],
          total: 60000
        }),
        [sheetKey('ok')]: JSON.stringify({ phone: '0909', customerName: 'Buyer' })
      });
      const res = await dindinRouter.fetch(req('POST', '/checkout', { sessionId: 'ok', payment_method: 'cod' }), makeEnv(db, kv));
      expect(res.status).toBe(200);
      const body = await (res.json() as Promise<any>);
      expect(body).toBeDefined();
      expect(body.success).toBe(true);
      expect(body.orderId).toBeDefined();
      // cart cleared
      const cartRes = await dindinRouter.fetch(req('GET', '/cart/ok'), makeEnv(mkDB(), kv));
      const cartParsed = (await (cartRes.json() as any));
      expect(cartParsed.data.items).toHaveLength(0);
    });

    it('D07 (400) — no menu config', async() => {
      // Cart in KV → no D1 cart query. [0]=null config → D07
      const db = mkDB([
        { first: async() => null } // no config row
      ]);
      const kv = mkKV({
        [cartKey('nocfg')]: JSON.stringify({ items: [{ name: 'X', price: 100, qty: 1 }], total: 100 }),
        [sheetKey('nocfg')]: JSON.stringify({ phone: '0909' })
      });
      const res = await dindinRouter.fetch(req('POST', '/checkout', { sessionId: 'nocfg', payment_method: 'cod' }), makeEnv(db, kv));
      expect(res.status).toBe(400);
      expect(((await res.json()) as any).code).toBe('D07');
    });

  });

  // ── Schema ───────────────────────────────────────────────────

  describe('dindinCheckoutSchema', () => {
    it('rejects missing sessionId', () => {
      expect(dindinCheckoutSchema.safeParse({ payment_method: 'cod' }).success).toBe(false);
    });
    it('rejects non-cod/payos payment_method', () => {
      expect(dindinCheckoutSchema.safeParse({ sessionId: 's1', payment_method: 'stripe' }).success).toBe(false);
    });
    it('rejects empty sessionId', () => {
      expect(dindinCheckoutSchema.safeParse({ sessionId: '', payment_method: 'cod' }).success).toBe(false);
    });
    it('accepts cod', () => {
      expect(dindinCheckoutSchema.safeParse({ sessionId: 's1', payment_method: 'cod' }).success).toBe(true);
    });
    it('accepts payos', () => {
      expect(dindinCheckoutSchema.safeParse({ sessionId: 's1', payment_method: 'payos' }).success).toBe(true);
    });
  });
});
