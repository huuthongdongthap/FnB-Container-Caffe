---
phase: 1
title: "Backend: Top Products + Peak Hours Endpoints"
status: pending
priority: P1
effort: 1h
mode: tdd
dependencies: []
---

# Phase 1: Top Products + Peak Hours

## Overview

Add two new endpoints to `worker/src/routes/reports.ts` for top-selling products and peak ordering hours.

## TDD Steps

1. Write tests in `tests/reports.test.ts` for both new endpoints
2. Implement endpoints
3. Verify tests pass

## Endpoints

### `GET /api/reports/top-products?from=&to=&limit=10`

Parse `items` JSON column in orders, aggregate by product name:

```sql
-- Need to extract items from orders JSON column
-- Approach: fetch orders in date range, parse items JSON in JS
```

Since `items` is a JSON TEXT column, parsing in JavaScript is safer than SQL JSON functions:

```typescript
const { results } = await db.prepare(
  `SELECT items FROM orders 
   WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled'`
).bind(from, to).all<{ items: string }>();

// Parse items JSON in JS, aggregate by name
const productMap = new Map<string, { qty: number; revenue: number }>();
for (const row of results || []) {
  const items = JSON.parse(row.items || '[]');
  for (const item of items) {
    const name = item.name || item.product_name || 'Unknown';
    const qty = item.qty || item.quantity || 1;
    const price = item.price || item.unit_price || 0;
    productMap.set(name, {
      qty: (productMap.get(name)?.qty || 0) + qty,
      revenue: (productMap.get(name)?.revenue || 0) + price * qty,
    });
  }
}

// Sort by qty desc, take top N
const topProducts = [...productMap.entries()]
  .map(([name, data]) => ({ name, ...data }))
  .sort((a, b) => b.qty - a.qty)
  .slice(0, parseInt(limit || '10'));
```

### `GET /api/reports/peak-hours?from=&to=`

Count orders grouped by hour of day:

```sql
SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, 
       COUNT(*) as order_count,
       COALESCE(SUM(total), 0) as revenue
FROM orders 
WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'cancelled'
GROUP BY hour ORDER BY hour
```

## Test Cases

```typescript
// GET /api/reports/top-products
test('returns top products with qty and revenue', async () => { ... });
test('respects limit parameter', async () => { ... });
test('handles empty results', async () => { ... });
test('handles malformed JSON in items column', async () => { ... });

// GET /api/reports/peak-hours
test('returns 24 hour buckets', async () => { ... });
test('aggregates orders by hour correctly', async () => { ... });
test('handles date range', async () => { ... });
```

## Related Code Files

- Modify: `worker/src/routes/reports.ts`
- Create/Modify: `tests/reports.test.ts`

## Success Criteria

- [ ] Top products endpoint returns { name, qty, revenue } sorted by qty
- [ ] Peak hours endpoint returns 24 { hour, order_count, revenue } buckets
- [ ] Empty date range returns empty arrays
- [ ] Malformed JSON in items column doesn't crash (skipped gracefully)
- [ ] Tests pass, no regressions

## Risk Assessment

- Items column may have different JSON shapes (old format vs new format)
  → Mitigation: handle both `name`/`product_name`, `qty`/`quantity`, `price`/`unit_price` fields
