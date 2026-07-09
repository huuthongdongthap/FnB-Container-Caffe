import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateMRRSnapshot } from '../../../tree/subscriptions/mrr-calculator';

function makeChain(
  firstResult: unknown = null,
  allResults: unknown[] = [],
  runResult: { success: boolean; changes: number } = { success: true, changes: 0 }
) {
  const chain: Record<string, unknown> = {};
  chain.bind = vi.fn(() => {
    return chain;
  });
  chain.first = vi.fn(async() => firstResult);
  chain.all = vi.fn(async() => ({ results: allResults }));
  chain.run = vi.fn(async() => runResult);
  return chain as never;
}

function makeDB(chains: Record<string, unknown>[] = [makeChain()]) {
  const queue = [...chains];
  return {
    prepare: vi.fn((_sql: string) => queue.shift() ?? makeChain())
  };
}

describe('mrr-calculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes a new snapshot when data exists', async() => {
    const db = makeDB([
      makeChain({ mrr: 1500000, count: 3 }), // active .first()
      makeChain({ churn_count: 0 }), // churned .first()
      makeChain({ new_count: 1 }), // newSubs .first()
      makeChain({ success: true, changes: 1 }) // INSERT .run()
    ]);

    await updateMRRSnapshot(db as never);

    expect(db.prepare).toHaveBeenCalledTimes(4);

    const insertSql = db.prepare.mock.calls[3]?.[0] as string | undefined;
    expect(insertSql).toBeDefined();
    expect(insertSql).toContain('INSERT');
    expect(insertSql).toContain('mrr_snapshots');
    expect(insertSql).toContain('ON CONFLICT');
  });

  it('inserts snapshot with all computed columns', async() => {
    const db = makeDB([
      makeChain({ mrr: 2000000, count: 10 }),
      makeChain({ churn_count: 2 }),
      makeChain({ new_count: 3 }),
      makeChain({ success: true, changes: 1 })
    ]);

    await updateMRRSnapshot(db as never);

    const insertSql = db.prepare.mock.calls[3]?.[0] as string | undefined;
    expect(insertSql).toBeDefined();
    expect(insertSql).toContain('churn_rate_pct');
    expect(insertSql).toContain('avg_contract_value_vnd');
    expect(insertSql).toContain('snapshot_date');
    expect(insertSql).toContain('mrr_snapshots');
  });

  it('inserts baseline snapshot when no active subs', async() => {
    const db = makeDB([
      makeChain({ mrr: 0, count: 0 }),
      makeChain({ churn_count: 0 }),
      makeChain({ new_count: 0 }),
      makeChain({ success: true, changes: 1 })
    ]);

    await expect(updateMRRSnapshot(db as never)).resolves.toBeUndefined();

    expect(db.prepare).toHaveBeenCalledTimes(4);
    const insertSql = db.prepare.mock.calls[3]?.[0] as string | undefined;
    expect(insertSql).toContain('INSERT');
    expect(insertSql).toContain('mrr_snapshots');
  });

  it('handles null active result gracefully', async() => {
    const db = makeDB([
      makeChain(null),
      makeChain({ churn_count: 0 }),
      makeChain({ new_count: 0 }),
      makeChain({ success: true, changes: 1 })
    ]);

    await expect(updateMRRSnapshot(db as never)).resolves.toBeUndefined();
  });

  it('inserts today() date expression for snapshot_date', async() => {
    const db = makeDB([
      makeChain({ mrr: 100000, count: 1 }),
      makeChain({ churn_count: 0 }),
      makeChain({ new_count: 0 }),
      makeChain({ success: true, changes: 1 })
    ]);

    await updateMRRSnapshot(db as never);

    const insertSql = db.prepare.mock.calls[3]?.[0] as string | undefined;
    expect(insertSql).toBeDefined();
    expect(insertSql).toContain('INSERT');
    expect(insertSql).toContain('mrr_snapshots');
    // SQL will contain date() or date expression for snapshot_date
    expect(insertSql).toMatch(/snapshot_date|date\s*\(/i);
  });

  it('includes avg_contract_value_vnd when active count > 0', async() => {
    const db = makeDB([
      makeChain({ mrr: 1000000, count: 2 }),
      makeChain({ churn_count: 0 }),
      makeChain({ new_count: 0 }),
      makeChain({ success: true, changes: 1 })
    ]);

    await updateMRRSnapshot(db as never);

    expect(db.prepare).toHaveBeenCalledTimes(4);
    const insertSql = db.prepare.mock.calls[3]?.[0] as string | undefined;
    expect(insertSql).toContain('INSERT');
    expect(insertSql).toContain('avg_contract_value_vnd');
  });
});
