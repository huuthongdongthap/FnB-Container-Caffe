// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { app } from '../../index';
import { paymentSqliteDB } from '../helpers/payment-sqlite-db';
import { createMockEnv, TEST_JWT_SECRET } from '../test-utils';
import { generateJWT } from '../../lib/jwt';

describe('Mounted refund route smoke', () => {
  it('fails closed through the public route instead of simulating unsupported PayOS refunds', async () => {
    const sql = paymentSqliteDB(); sql.order('ORDER'); sql.payment('ORDER', 'completed');
    const token = await generateJWT({ id: 'OWNER', role: 'owner', tenantId: 'default' }, TEST_JWT_SECRET);
    const spy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No provider calls allowed'));
    try {
      const res = await app.fetch(new Request('https://test.aura/api/payments/refund', { method: 'POST', headers: {
        'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ paymentId: 'pay_ORDER', amount: 20000, reason: 'Local test' }) }), { ...createMockEnv(), AURA_DB: sql.db });
      expect(res.status).toBe(422); expect(await res.json()).toMatchObject({ code: 'REFUND_PROVIDER_UNAVAILABLE' });
      expect(sql.sqlite.prepare('SELECT status, refund_status FROM payments').get()).toMatchObject({ status: 'completed', refund_status: null });
      expect(spy).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });
});
