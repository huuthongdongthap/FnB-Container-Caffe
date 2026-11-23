import { describe, it, expect, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { releaseStaleReservedTables } from '../../routes/openapi-tables-handlers/table-crud-handlers';

interface RecordedQuery {
  sql: string;
  binds: unknown[];
}

function createMockDb(options: {
  hasReserved: boolean;
  failOnReservationDate?: boolean;
  failOnDate?: boolean;
}) {
  const queries: RecordedQuery[] = [];
  const db = {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...binds: unknown[]) => {
        queries.push({ sql, binds });
        return {
          first: vi.fn(async () => {
            if (sql.includes('SELECT 1 AS found FROM cafe_tables')) {
              return options.hasReserved ? { found: 1 } : null;
            }
            return null;
          }),
          run: vi.fn(async () => {
            if (options.failOnReservationDate && sql.includes('r.reservation_date')) {
              throw new Error('no such column: r.reservation_date');
            }
            if (options.failOnDate && sql.includes('r.date')) {
              throw new Error('no such column: r.date');
            }
            return { success: true, meta: { changes: 1 } };
          }),
        };
      }),
    })),
  };
  return { db: db as unknown as D1Database, queries };
}

describe('releaseStaleReservedTables', () => {
  it('skips UPDATE write when no Reserved tables exist for tenant', async () => {
    const { db, queries } = createMockDb({ hasReserved: false });
    await releaseStaleReservedTables(db, 'tenant_a');

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toContain('SELECT 1 AS found FROM cafe_tables');
    expect(queries[0]?.binds).toEqual(['tenant_a']);
  });

  it('runs UPDATE with dual-column COALESCE(reservation_date, date), approved/checked_in statuses, and tenant isolation', async () => {
    const { db, queries } = createMockDb({ hasReserved: true });
    await releaseStaleReservedTables(db, 'tenant_b');

    expect(queries).toHaveLength(2);
    const updateQuery = queries[1];
    expect(updateQuery?.sql).toContain("UPDATE cafe_tables");
    expect(updateQuery?.sql).toContain("'approved'");
    expect(updateQuery?.sql).toContain("'checked_in'");
    expect(updateQuery?.sql).toContain("COALESCE(NULLIF(TRIM(r.reservation_date), ''), r.date, '')");
    expect(updateQuery?.sql).toContain('r.tenant_id');
    expect(updateQuery?.binds).toEqual([expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), 'tenant_b', 'tenant_b']);
  });

  it('falls back to legacy r.date column when r.reservation_date does not exist', async () => {
    const { db, queries } = createMockDb({
      hasReserved: true,
      failOnReservationDate: true,
    });
    await releaseStaleReservedTables(db, 'tenant_c');

    expect(queries).toHaveLength(3);
    expect(queries[1]?.sql).toContain("COALESCE(NULLIF(TRIM(r.reservation_date), ''), r.date, '')");
    expect(queries[2]?.sql).toContain("COALESCE(r.date, '')");
    expect(queries[2]?.sql).toContain("'approved'");
    expect(queries[2]?.binds).toEqual([expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), 'tenant_c', 'tenant_c']);
  });

  it('falls back to r.reservation_date when legacy r.date column does not exist', async () => {
    const { db, queries } = createMockDb({
      hasReserved: true,
      failOnDate: true,
    });
    await releaseStaleReservedTables(db, 'tenant_d');

    expect(queries).toHaveLength(3);
    expect(queries[1]?.sql).toContain("COALESCE(NULLIF(TRIM(r.reservation_date), ''), r.date, '')");
    expect(queries[2]?.sql).toContain("COALESCE(r.reservation_date, '')");
    expect(queries[2]?.binds).toEqual([expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), 'tenant_d', 'tenant_d']);
  });
});
