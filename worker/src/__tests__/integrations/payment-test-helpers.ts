/**
 * Shared Payment Test Helpers
 */

import { Hono } from 'hono';
import { createHmac } from 'node:crypto';
import { registerPayosWebhook } from '../../routes/webhooks-handlers/payos';
import { paymentRouter } from '@aura/domain-payment';
import { paymentSqliteDB } from '../helpers/payment-sqlite-db';
import { handleMarkCodPaid } from '../../routes/orders-hono-handlers/kds-handlers';

export const TEST_CHECKSUM_KEY = 'test_checksum_key_32_bytes_len!!';

export function signPayosData(data: Record<string, unknown>, key: string): string {
  const sorted = Object.keys(data).sort().map((k) => `${k}=${data[k]}`).join('&');
  return createHmac('sha256', key).update(sorted).digest('hex');
}

export function makeWebhookTestEnv(config: {
  payment?: { id: string; order_id: string; status: string; amount: number; method?: string } | null;
  orderMethod?: string;
  runChanges?: number;
}) {
  const fixture = paymentSqliteDB();
  const executedStatements = fixture.executedStatements;
  const kvStore = new Map<string, string>();
  if (config.payment) {
    fixture.seed('orders', { id: config.payment.order_id, total: config.payment.amount,
      payment_method: config.orderMethod ?? 'payos', payment_status: config.payment.status === 'completed' ? 'paid' : 'unpaid' });
    fixture.seed('payments', { ...config.payment, method: config.payment.method ?? 'payos', transaction_id: '12345' });
  }
  const db = fixture.db;

  const app = new Hono<{ Bindings: any }>();
  registerPayosWebhook(app);

  return {
    app,
    executedStatements,
    kvStore,
    env: {
      AURA_DB: db,
      AUTH_KV: {
        put: async (k: string, v: string) => { kvStore.set(k, v); },
        get: async (k: string) => kvStore.get(k) ?? null,
      },
      PAYOS_CHECKSUM_KEY: TEST_CHECKSUM_KEY,
    },
  };
}

export function makeCodTestEnv(orderRow: {
  id: string;
  total: number;
  status: string;
  payment_status: string;
  payment_method?: string;
  is_cod?: number;
} | null) {
  const executedStatements: Array<{ sql: string; binds: unknown[] }> = [];

  const db = {
    prepare: (sql: string) => {
      let binds: unknown[] = [];
      const stmt = {
        bind: (...args: unknown[]) => {
          binds = args;
          return stmt;
        },
        first: async () => {
          if (sql.includes('FROM orders WHERE id = ?')) {
            return orderRow;
          }
          return null;
        },
        run: async () => {
          executedStatements.push({ sql, binds });
          return { success: true, changes: 1, meta: { changes: 1 }, lastRowId: 1 };
        },
        all: async () => ({ results: sql.includes('FROM payments') && orderRow?.payment_status === 'paid'
          ? [{ id: 'COD_LEDGER', amount: orderRow.total, status: 'completed' }] : [], success: true }),
      };
      return stmt as any;
    },
    batch: async (statements: Array<{ run(): Promise<unknown> }>) => {
      const results = []; for (const statement of statements) results.push(await statement.run()); return results;
    },
  };

  const paymentApp = new Hono<{ Bindings: any }>();
  paymentApp.route('/api/payment', paymentRouter);

  const kdsApp = new Hono<{ Bindings: any }>();
  kdsApp.patch('/:id/mark-cod-paid', handleMarkCodPaid);

  return {
    paymentApp,
    kdsApp,
    executedStatements,
    env: {
      AURA_DB: db,
      PAYOS_CLIENT_ID: 'client_123',
      PAYOS_API_KEY: 'key_123',
      PAYOS_CHECKSUM_KEY: 'checksum_123',
    },
  };
}
