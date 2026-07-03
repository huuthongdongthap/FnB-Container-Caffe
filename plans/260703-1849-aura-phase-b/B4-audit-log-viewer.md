# B4: Audit Log Viewer

**Date:** 2026-07-03
**Status:** Planned
**Priority:** P2 Medium
**Source:** docs/05_TASKS/admin.md backlog (P2, 12h estimated)
**Effort:** 10-12 hours
**Dependencies:** None (adds new middleware + table)
**Blocks:** None

---

## 1. Technical Design

### Problem Statement

Admin actions (order status changes, staff edits, config changes, promo modifications) are not tracked. When an order is cancelled or a staff member changes a menu price, there is no audit trail. The cafe owner cannot answer "who changed this and when?".

### Architecture

Middleware-based audit logging hooks into existing route patterns. A new `audit_logs` D1 table stores each action. An admin page provides browse/filter/search.

```
Request Flow (admin routes only):
  auth middleware ──> audit middleware (records pre-state + action)
       │
  Route handler ──> audit middleware (records post-state + result)
       │
  ctx.waitUntil ──> D1 insert to audit_logs table

Admin Viewer:
  GET /api/admin/audit-logs?user=&action=&date_from=&date_to=&limit=50
    └── React: AuditLogViewer.tsx with filter panel + paginated table
```

### D1 Schema

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT NOT NULL,           -- staff ID
  actor_name TEXT NOT NULL,         -- staff display name
  action TEXT NOT NULL,             -- 'order.update_status', 'menu.edit', 'staff.create', etc.
  resource_type TEXT NOT NULL,      -- 'order', 'menu', 'staff', 'promo', 'config'
  resource_id TEXT,                 -- affected entity ID
  details TEXT DEFAULT '{}',        -- JSON: {before, after, diff, metadata}
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
```

### Key Design Decisions

1. **Middleware-based, not per-route** — A single middleware wrapper records request context. Per-route handlers optionally call `audit.log()` with action-specific details.

2. **Pre/post state recording** — For critical actions (order status, menu price), the middleware captures the entity state before and after modification.

3. **Storage budget** — ~200 bytes per audit entry. At 500 entries/day (generous for a single cafe), that's 100KB/day, ~3MB/month. Well within D1 free tier (5GB).

4. **Retention** — 90 days via cron cleanup. Admin can export before prune.

5. **No PII in details** — Audit logs contain staff ID, action, entity IDs. No customer phone numbers, addresses, or payment details.

---

## 2. File List

### Files to Create

| File | Purpose |
|------|---------|
| `worker/src/lib/audit-logger.ts` | `AuditLogger` class — `log()`, `query()`, `prune()` methods |
| `worker/src/routes/admin-audit-logs.ts` | `GET /api/admin/audit-logs` with filter/pagination |
| `src/pages/admin/AuditLogViewer.tsx` | Admin page: filter panel + paginated table + CSV export |
| `src/tree/audit/use-audit-store.ts` | Zustand store for audit log state |
| `worker/migrations/005_audit_logs.sql` | `audit_logs` table |
| `worker/src/__tests__/lib/audit-logger.test.ts` | Unit tests |
| `worker/src/__tests__/routes/admin-audit-logs.test.ts` | Integration tests |

### Files to Modify

| File | Change |
|------|--------|
| `worker/src/middleware/logger.ts` | Add audit middleware wrapper for admin routes |
| `worker/src/index.ts` | Register audit route, audit middleware, cron prune |
| `src/pages/admin/AdminSidebar.tsx` or equivalent nav | Add "Audit Log" nav item |

---

## 3. Database Changes

### Migration: `005_audit_logs.sql`

- `audit_logs` table with indexes on (actor_id, created_at), (action, created_at), (resource_type, resource_id)
- Retention: prune older than 90 days via cron

---

## 4. API Endpoints

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/admin/audit-logs` | Query audit logs with filters | Owner |
| GET | `/api/admin/audit-logs/export` | CSV export of filtered results | Owner |

Query parameters:

| Param | Values | Description |
|-------|--------|-------------|
| `actor_id` | staff ID | Filter by staff member |
| `action` | action name | Filter by action type |
| `resource_type` | order/menu/staff/promo/config | Filter by resource |
| `date_from` / `date_to` | ISO date | Date range filter |
| `limit` | 10-200 | Page size (default 50) |
| `offset` | integer | Pagination offset |

---

## 5. Frontend Components

| Component | File | Description |
|-----------|------|-------------|
| AuditLogViewer | `src/pages/admin/AuditLogViewer.tsx` | Full page: date range picker, actor/action filter dropdowns, searchable table, CSV export button |
| use-audit-store | `src/tree/audit/use-audit-store.ts` | Zustand store: logs[], filters, pagination, loading/error states, fetchLogs(), exportCSV() |

States:
- **Loading:** Skeleton rows (10 rows matching page size)
- **Empty:** "No audit logs match your filters" with reset button
- **Error:** "Failed to load audit logs" with retry button
- **Edge case:** Single row, many rows, filtered to 0

---

## 6. Tests

| Test | File | What to verify |
|------|------|----------------|
| AuditLogger unit | `worker/src/__tests__/lib/audit-logger.test.ts` | `log()` stores correct data, `query()` filters correctly, `prune()` removes old entries |
| Audit logs API | `worker/src/__tests__/routes/admin-audit-logs.test.ts` | Pagination, date filtering, actor filtering, CSV export format |
| Frontend store | `src/tree/audit/__tests__/use-audit-store.test.ts` | State transitions, filter updates |

---

## 7. Acceptance Criteria

### Audit Logging
- [ ] Every admin action (order status change, menu edit, staff CRUD, promo edit, config change) creates an audit entry
- [ ] Audit entry contains: actor, action, resource type, resource ID, timestamp, IP
- [ ] Pre/post state recorded for order status changes and menu price edits
- [ ] No PII in any audit entry

### Admin Viewer
- [ ] Date range filter (date_from / date_to) with validation
- [ ] Actor filter: dropdown with staff list
- [ ] Action filter: dropdown with action types
- [ ] Resource type filter: tabs or dropdown
- [ ] Paginated results (50 per page)
- [ ] CSV export button with filtered results
- [ ] Page accessible only to owner role
- [ ] Loading / empty / error states handled

### Quality Gates
- [ ] `npm run build` = 0 errors
- [ ] `npm test` = all tests pass
- [ ] Migration `005_audit_logs.sql` applies cleanly
- [ ] Audit log writes are non-blocking (ctx.waitUntil)

---

## 8. Rollback Plan

```bash
# Revert code
git checkout HEAD -- worker/src/lib/audit-logger.ts worker/src/routes/admin-audit-logs.ts
git checkout HEAD -- src/pages/admin/AuditLogViewer.tsx src/tree/audit/

# Drop table
npx wrangler d1 execute AURA_DB --command "DROP TABLE IF EXISTS audit_logs;"
```

---

## 9. Estimated Effort

| Task | Time |
|------|------|
| Create D1 migration | 15 min |
| Build AuditLogger class (log, query, prune) | 1.5h |
| Build audit middleware hooks in logger.ts | 45 min |
| Wire existing routes to emit audit events | 1h |
| Build GET /api/admin/audit-logs + export | 1h |
| Build use-audit-store Zustand store | 30 min |
| Build AuditLogViewer page (filter panel + table + pagination) | 2h |
| Write tests (logger + API) | 1h |
| Build + test verification | 30 min |
| **Total** | **~10h** |
