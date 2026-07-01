---
phase: 4
title: DLQ Admin Visibility
status: completed
priority: P2
dependencies:
  - 2
effort: 30min
---

# Phase 4: DLQ Admin Visibility

## Overview

Add `GET /api/admin/payments/stuck` endpoint so admin dashboard can surface payments stuck in KV dead-letter queue. Add "Stuck Payments" card to admin dashboard showing count + quick actions.

## Requirements

- Functional: Admin can see count of stuck payments. Clicking drills into details. Owner-only auth.
- Non-functional: Sensitive amounts masked in list view. KV reads cached (1 min TTL on dashboard card).

## Architecture

```
Admin Dashboard
  ↓ GET /api/admin/payments/stuck (Bearer token, owner role)
Worker
  ↓ KV list { prefix: 'payment:stuck:' }
  ↓ KV list { prefix: 'webhook:dlq:' }
  ↓ return { stuck: [...], dlq: [...], total: N }
AdminDashboard
  ↓ shows count badge on "Stuck Payments" card
  ↓ click → expand list with order IDs, timestamps, error messages
```

## Related Code Files

- Modify: `worker/src/routes/webhooks.ts` — add `GET /stuck` endpoint
- Modify: `worker/src/index.ts` — mount stuck-payments route under admin middleware
- Create: `src/components/admin/stuck-payments-card.tsx` — dashboard card component
- Modify: `src/pages/admin/dashboard.tsx` — render StuckPaymentsCard (or relevant admin page)

## Implementation Steps

### Worker Endpoint

1. **Add `GET /stuck` route** in webhooks.ts (or new admin-payments route):
   ```js
   paymentRouter.get('/stuck', requireAuth(['owner']), async (c) => {
     const kv = c.env.AUTH_KV;
     if (!kv) return c.json({ stuck: [], dlq: [], total: 0 });

     const stuckList = await kv.list({ prefix: 'payment:stuck:' });
     const dlqList = await kv.list({ prefix: 'webhook:dlq:' });

     // Read first 20 stuck payment details
     const stuck = await Promise.all(
       stuckList.keys.slice(0, 20).map(async (k) => {
         const raw = await kv.get(k.name);
         return raw ? JSON.parse(raw) : null;
       })
     );

     const dlq = await Promise.all(
       dlqList.keys.slice(0, 20).map(async (k) => {
         const raw = await kv.get(k.name);
         return raw ? { key: k.name, ...JSON.parse(raw) } : null;
       })
     );

     return c.json({
       stuck: stuck.filter(Boolean).map(s => ({ ...s, amount: '***' })), // mask amounts
       dlq: dlq.filter(Boolean),
       total: stuckList.keys.length + dlqList.keys.length,
     });
   });
   ```
2. **Mount route** — ensure `requireAuth(['owner'])` middleware is applied
3. **Test** — Phase 1 DLQ test verifies endpoint auth + response shape

### Frontend Dashboard Card

4. **Create `StuckPaymentsCard`** — fetches `/api/admin/payments/stuck` on mount:
   ```tsx
   export function StuckPaymentsCard() {
     const [data, setData] = useState<{ total: number } | null>(null);
     useEffect(() => {
       apiFetch('/api/admin/payments/stuck').then(setData).catch(() => {});
     }, []);
     if (!data || data.total === 0) return null;
     return (
       <Card className="border-amber-300">
         <CardHeader>⚠️ Thanh toán treo</CardHeader>
         <CardBody>
           <p className="text-2xl font-bold text-amber-700">{data.total}</p>
           <p className="text-xs text-muted">Giao dịch cần đối soát thủ công</p>
         </CardBody>
       </Card>
     );
   }
   ```
5. **Wire to admin dashboard** — add `<StuckPaymentsCard />` to the dashboard grid
6. **Verify** — card shows 0 for clean state, count badge for stuck payments

## Success Criteria

- [ ] `GET /api/admin/payments/stuck` returns `{ stuck, dlq, total }` for owner role
- [ ] Returns 401/403 for non-owner (customer, staff)
- [ ] Amounts masked in list response (`***`)
- [ ] StuckPaymentsCard hidden when total = 0 (no visual noise)
- [ ] StuckPaymentsCard visible with count when stuck payments exist
- [ ] Worker tests pass (Phase 1 DLQ test)

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Exposing payment details to non-owner | `requireAuth(['owner'])` middleware blocks unauthorized access |
| KV list() expensive with many keys | Limit to 20 keys, cache dashboard fetch with 1-min staleTime |
| Stuck payment card causes alarm fatigue | Only shows when count > 0, not a persistent notification |
