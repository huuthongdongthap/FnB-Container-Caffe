// @vitest-environment node
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { processErpnextRetryQueue } from '../routes/cron-handlers/erpnext-sync';

// A fixed UTC SQLite clock makes same-day ordering deterministic in every locale.
const NOW = '2026-11-21 12:00:00';

for (const tenant of ['default', '*']) {
  for (const schema of ['joined', 'queue-only', 'legacy'] as const) {
    describe(`ERPNext retry timestamps: ${tenant}, ${schema}`, () => {
      it('selects elapsed ISO/SQLite and null retries without crossing tenant boundaries', async () => {
        const sqlite = new DatabaseSync(':memory:');
        const selected: string[] = [];
        let queryAttempts = 0;
        try {
          sqlite.exec(`
            CREATE TABLE erpnext_sync_queue (
              id TEXT PRIMARY KEY, entity_type TEXT, entity_id TEXT, action TEXT,
              payload TEXT, attempts INTEGER, next_retry_at TEXT, status TEXT,
              created_at TEXT, updated_at TEXT${schema !== 'legacy' ? ', tenant_id TEXT' : ''}
            );
            ${schema === 'joined' ? 'CREATE TABLE orders (id TEXT, tenant_id TEXT, status TEXT, payment_status TEXT);' : ''}
          `);
          const insert = sqlite.prepare(`INSERT INTO erpnext_sync_queue
            (id, entity_type, payload, attempts, next_retry_at, status, created_at${schema !== 'legacy' ? ', tenant_id' : ''})
            VALUES (?, 'product', ?, 0, ?, ?, ?${schema !== 'legacy' ? ', ?' : ''})`);
          const fixtures: Array<[string, string | null, string]> = [
            ['iso-past', '2026-11-21T11:59:00.000Z', 'pending'],
            ['iso-future', '2026-11-21T12:01:00.000Z', 'pending'],
            ['sqlite-past', '2026-11-21 11:59:00', 'pending'],
            ['sqlite-future', '2026-11-21 12:01:00', 'pending'],
            ['no-retry', null, 'pending'],
            ['completed', null, 'completed'],
          ];
          for (const rowTenant of ['default', 'other']) {
            for (const [id, retry, status] of fixtures) {
              const args: SQLInputValue[] = [
                `${rowTenant}-${id}`, JSON.stringify({ tenant_id: rowTenant }), retry, status, NOW,
              ];
              if (schema !== 'legacy') args.push(rowTenant);
              insert.run(...args);
            }
          }
          const db = {
            prepare(sql: string) {
              let bindings: SQLInputValue[] = [];
              const statement = {
                bind(...args: SQLInputValue[]) {
                  bindings = args;
                  return statement;
                },
                async all() {
                  queryAttempts++;
                  // Only substitute the clock; execute the handler's actual selector in SQLite.
                  const rows = sqlite.prepare(sql.replaceAll("datetime('now')", `datetime('${NOW}')`)).all(...bindings);
                  selected.push(...rows.map((row) => String(row.id)));
                  return { results: rows };
                },
                async run() {
                  const result = sqlite.prepare(sql).run(...bindings);
                  return { meta: { changes: Number(result.changes) } };
                },
              };
              return statement;
            },
          };
          const result = await processErpnextRetryQueue({
            AURA_DB: db,
            ERPNEXT_URL: 'https://erp.example.invalid',
            ERPNEXT_API_KEY: 'test-key',
            ERPNEXT_API_SECRET: 'test-secret',
          }, tenant);
          const tenants = tenant === '*' ? ['default', 'other'] : ['default'];
          const expected = tenants.flatMap((id) => ['iso-past', 'sqlite-past', 'no-retry'].map((suffix) => `${id}-${suffix}`));
          // Legacy selectors lack a tenant column; the handler must still filter payload tenants.
          const expectedSelected = schema === 'legacy'
            ? ['default', 'other'].flatMap((id) => ['iso-past', 'sqlite-past', 'no-retry'].map((suffix) => `${id}-${suffix}`))
            : expected;
          expect(selected.sort()).toEqual(expectedSelected.sort());
          expect(queryAttempts).toBe(schema === 'joined' ? 1 : schema === 'queue-only' ? 2 : 3);
          expect(result).toEqual({ processed: expected.length, succeeded: expected.length, failed: 0 });
          const completed = sqlite.prepare("SELECT id FROM erpnext_sync_queue WHERE status = 'completed' AND id NOT LIKE '%-completed'").all();
          // Legacy writes intentionally fall back only for the default tenant.
          const expectedCompleted = schema === 'legacy'
            ? expected.filter((id) => id.startsWith('default-'))
            : expected;
          expect(completed.map((row) => String(row.id)).sort()).toEqual(expectedCompleted.sort());
        } finally {
          sqlite.close();
        }
      });
    });
  }
}
