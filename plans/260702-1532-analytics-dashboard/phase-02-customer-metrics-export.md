---
phase: 2
title: "Backend: Customer Metrics + CSV Export"
status: pending
priority: P1
effort: 1h
mode: tdd
dependencies: []
---

# Phase 2: Customer Metrics + CSV Export

## Overview

Add customer loyalty metrics endpoint and CSV export to `worker/src/routes/reports.ts`.

## TDD Steps

1. Write tests for customer metrics and export endpoints
2. Implement endpoints
3. Verify tests pass

## Endpoints

### `GET /api/reports/customers`

```sql
-- Total customers
SELECT COUNT(*) as total FROM customers

-- New customers (30d)
SELECT COUNT(*) as new_30d FROM customers 
WHERE created_at >= datetime('now', '-30 days')

-- Customers with >1 order (repeat)
SELECT COUNT(*) as repeat FROM (
  SELECT customer_id FROM orders 
  WHERE status != 'cancelled'
  GROUP BY customer_id HAVING COUNT(*) > 1
)

-- Avg spend per customer
SELECT COALESCE(SUM(total) / NULLIF(COUNT(DISTINCT customer_id), 0), 0) as avg_spend
FROM orders WHERE status != 'cancelled'
```

Response shape:
```json
{
  "success": true,
  "data": {
    "total_customers": 150,
    "new_customers_30d": 12,
    "repeat_customers": 45,
    "repeat_rate": 30.0,
    "avg_spend_per_customer": 85000,
    "avg_orders_per_customer": 2.3
  }
}
```

### `GET /api/reports/export?from=&to=&type=orders|revenue|customers`

Returns `Content-Type: text/csv` with appropriate columns:

- **orders:** order_id, customer_name, customer_phone, items, total, status, payment_method, created_at
- **revenue:** date, orders, revenue, avg_order_value, cashback_earned
- **customers:** customer_id, name, email, phone, total_spent, order_count, loyalty_tier, created_at

## Test Cases

```typescript
// GET /api/reports/customers
test('returns customer metrics with repeat rate', async () => { ... });
test('handles zero customers', async () => { ... });

// GET /api/reports/export
test('returns CSV content-type for orders export', async () => { ... });
test('returns CSV content-type for revenue export', async () => { ... });
test('returns CSV content-type for customers export', async () => { ... });
test('returns 400 for invalid export type', async () => { ... });
test('handles empty export gracefully', async () => { ... });
```

## Related Code Files

- Modify: `worker/src/routes/reports.ts`

## Success Criteria

- [ ] Customer metrics returns all 6 fields with correct calculations
- [ ] CSV export returns `Content-Type: text/csv` with BOM for Excel
- [ ] Invalid export type returns 400
- [ ] All tests pass, no regressions

## Risk Assessment

- Large exports may hit Worker CPU timeout (30s free tier)
  → Mitigation: add LIMIT 5000 and date bounds to all export queries
