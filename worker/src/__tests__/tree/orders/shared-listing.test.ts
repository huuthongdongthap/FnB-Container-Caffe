import { describe, it, expect } from 'vitest';
import { buildOrderFilterClause, buildOrderTail } from '../../../tree/orders/shared-listing';

describe('buildOrderFilterClause', () => {
  it('returns empty clause and params with no filters', () => {
    const { clause, params } = buildOrderFilterClause({});
    expect(clause).toBe('');
    expect(params).toEqual([]);
  });

  it('appends one AND per filter, values bound in order', () => {
    const { clause, params } = buildOrderFilterClause({
      filters: [['o.status', 'completed'], ['o.payment_status', 'paid']]
    });
    expect(clause).toBe(' AND o.status = ? AND o.payment_status = ?');
    expect(params).toEqual(['completed', 'paid']);
  });
});

describe('buildOrderTail', () => {
  it('defaults: created_at ASC limit 50 offset 0', () => {
    expect(buildOrderTail({})).toBe(' ORDER BY created_at ASC LIMIT 50 OFFSET 0');
  });

  it('honors explicit sort/direction/pagination', () => {
    expect(buildOrderTail({ sort: 'total', order: 'DESC', limit: 10, offset: 20 }))
      .toBe(' ORDER BY total DESC LIMIT 10 OFFSET 20');
  });

  it('falls back to created_at for invalid sort column (no throw)', () => {
    expect(buildOrderTail({ sort: 'invalid_field' as 'created_at', order: 'DESC' }))
      .toBe(' ORDER BY created_at DESC LIMIT 50 OFFSET 0');
  });

  it('clamps non-positive limit to 1 and negative offset to 0', () => {
    expect(buildOrderTail({ limit: 0 })).toContain('LIMIT 1');
    expect(buildOrderTail({ limit: -5 })).toContain('LIMIT 1');
    expect(buildOrderTail({ offset: -10 })).toContain('OFFSET 0');
  });
});
