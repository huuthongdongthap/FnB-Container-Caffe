import { describe, it, expect, vi } from 'vitest';
import { tablesRouter } from '../../routes/tables';
import { createMockEnv, createMockContext } from '../test-utils';

const VALID_SECRET = 'qr-signing-secret-2026';

function qrMockDb(
  tables: any[] = [],
  qrRows: any[] = [],
  tableRow: any | null = null
): any {
  let callNumber = 0;
  return {
    prepare: (sql: string) => {
      callNumber++;
      const binds: any[] = [];
      const stmt: any = {
        _sql: sql,
        bind(...args: any[]) {
          binds.push(...args); return stmt;
        },
        raw: async() => [],
        run: async() => ({ success: true, changes: 1 }),
        first: async() => {
          console.log(`  [first #${callNumber}] sql=${sql.substring(0, 50)} binds=${JSON.stringify(binds)}`);
          if (sql.includes('table_qr_codes WHERE slug')) {
            return qrRows.length > 0 ? qrRows[0] : null;
          }
          if (sql.includes('cafe_tables WHERE id')) {
            return tableRow;
          }
          return null;
        },
        all: async() => {
          console.log(`  [all #${callNumber}] sql=${sql.substring(0, 50)}`);
          return { results: qrRows.length ? qrRows : tables, success: true };
        }
      };
      return stmt;
    },
    batch: async() => [],
    exec: async() => ({ count: 0, duration: 0 }),
    dump: async() => new Uint8Array()
  };
}

async function fetchTables(path: string, envOverrides: any = {}): Promise<Response> {
  const env = { ...createMockEnv(), ...envOverrides };
  const ctx = createMockContext();
  const req = new Request(`https://test.aura${path}`);
  return tablesRouter.fetch(req, env as any, ctx as any);
}

describe('debug', () => {
  it('wrong sig', async() => {
    const res = await fetchTables('/api/qr/t01?ts=9999999999&sig=invalid', {
      AURA_DB: qrMockDb([], [], null),
      QR_SIGNING_SECRET: VALID_SECRET
    });
    console.log('status:', res.status);
  });
});
