import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createMockEnv, TEST_JWT_SECRET } from '../test-utils';
import { generateJWT } from '../../lib/jwt';

async function ownerHeaders() {
  const t = await generateJWT({ id: 'U1', email: 'e@t.com', name: 'O', role: 'owner' }, TEST_JWT_SECRET, '3600');
  return { Authorization: `Bearer ${t}` };
}

describe('debug', () => {
  it('raw response inspection', async () => {
    const router = (await import('../../routes/refunds')).refundRouter;
    let prepCount = 0;
    const db: any = {
      prepare: (sql: string) => {
        prepCount++;
        const s = sql.replace(/\s+/g, ' ').trim();
        console.log(`  [${prepCount}] ${s.slice(0, 90)}`);
        const n = s.toLowerCase();
        let target: any = null;
        if (n.includes('payments where')) target = { id: 'PAY_1', order_id: 'ORD_1', method: 'payos', amount: 50000, status: 'paid', transaction_id: '111', refund_status: null, refund_amount: null };
        if (n.includes('from orders')) target = { id: 'ORD_1', customer_id: 'C1', cashback_earned: 0, points_earned: 0 };
        if (n.includes('from customers')) target = { id: 'C1', loyalty_points: 500, lifetime_points: 500 };
        if (n.includes('from cashback_wallets')) target = { id: 'WAL_1', customer_id: 'C1', balance: 5000 };
        const stmt: any = { _sql: s, _binds: [], bind(..._a: any[]) { return stmt; } };
        stmt.first = async () => { console.log(`  -> first() returns:`, target ? (target.id || target.refund_status || 'cust/wallet') : 'null'); return target; };
        stmt.all = async () => ({ results: [] });
        stmt.run = async () => ({ success: true, changes: 1 });
        stmt.raw = async () => [];
        return stmt;
      },
      batch: async () => [],
      exec: async () => ({ count: 0 }),
      dump: async () => new Uint8Array(),
    };
    const env = { ...createMockEnv(), AURA_DB: db };
    const h = await ownerHeaders();
    const req = new Request('https://x.api/payments/refund', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify({ paymentId: 'PAY_1', amount: 50000, reason: 't' }) });
    const r = await router.fetch(req, env);
    const text = await r.text();
    console.log('\nStatus:', r.status);
    console.log('Headers:', [...r.headers.entries()]);
    console.log('Body:', text.slice(0, 200));
    expect(true).toBe(true);
  });
});
