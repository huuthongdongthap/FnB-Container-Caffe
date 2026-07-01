---
phase: 5
title: "TypeScript :any Cleanup — Client/Env/DB Casts"
status: pending
priority: P0
effort: 2h
dependencies: []
---

# Phase 5: TypeScript `:any` Cleanup — Client/Env/DB Casts

## Overview

Fix the remaining `as any` and `:any` patterns not covered by Phase 4:

1. **`(client as any).method()`** — loose client return types (pretix.ts 14x, mixpost.ts 19x, mautic-bridge.ts 11x)
2. **`env.AURA_DB as any`** — environment access casts
3. **`results as any[]`** — DB query result casts
4. **`body as any`** — passing objects to external APIs

## TDD Contract

1. Tests lock current behavior
2. Replace casts with proper types
3. Fix TypeScript errors surfaced
4. Run tests — must stay green

## Work Items

### 5a: Client method casts → proper interfaces (1h)

**pretix.ts** — `(client as any).method()` (14 occurrences):
- Define typed return interfaces for each method used: `ListEventsResponse`, `GetEventResponse`, `ListItemsResponse`, `RedeemCheckinResponse`
- Or use the existing `PretixClient` interface from `pretix-client.ts` and extend it with proper method signatures
- Replace `(client as any).listEvents(...)` with `client.listEvents(...)` after adding return types

**mixpost.ts** — `(client as any).createPost(...)` (19 occurrences):
- Define `CreatePostResult` interface
- Replace `(client as any).createPost({...} as any)` with properly typed calls

**mautic-bridge.ts** — `(client as any).syncContacts(...)` (11 occurrences):
- Define `SyncContactsResult` interface
- Replace casts with proper types

### 5b: Environment access casts (0.5h)

**Files:** mixpost.ts, mautic-bridge.ts, cron.ts

**Current:** `const db = env.AURA_DB as any;`
**Fix:** Use `D1Database` type directly:
```typescript
import type { D1Database } from '@cloudflare/workers-types';
const db = env.AURA_DB as D1Database;
```
Or better: type the function parameter as `Env` instead of `Record<string, unknown>`.

### 5c: DB query result casts (0.5h)

**Files:** mixpost.ts (4 occurrences), cal-booking-webhook.ts (3 occurrences)

**Current:** `const promos = results as any[];` or `const available = (zoneResults || []) as any[];`

**Fix:** Define typed interfaces for each query result:
```typescript
interface ProductRow { id: string; name: string; price: number; is_available: number; category_id?: number; }
const products = (results || []) as ProductRow[];
```

Add interfaces at the top of each route file for the table shapes it queries.

### 5d: Body/external API casts (removed by Phase 3)

Most `body as any` casts will be eliminated by Phase 3 (Zod validation). Any remaining ones should be replaced with proper inferred types from Zod.

## Files Changed

- `worker/src/routes/pretix.ts`: 14 `as any` → proper client method types
- `worker/src/routes/mixpost.ts`: 19 `as any` → typed DB rows + client results
- `worker/src/routes/mautic-bridge.ts`: 11 `as any` → typed env access + client results
- `worker/src/routes/cron.ts`: 1 `as any`
- `worker/src/routes/cal-booking-webhook.ts`: 3 `as any`
- `worker/src/routes/erpnext.ts`, `erpnext-pos.ts`, `erpnext-invoices.ts`: ~6 `as any`
- `worker/src/lib/pretix-client.ts`: extend interface with method signatures (if needed)

## Validation

```bash
npm run build  # 0 TypeScript errors
npm test       # all tests pass
```

## Success Criteria

- [ ] Zero `as any` in `worker/src/routes/` production code
- [ ] Client methods have proper return types
- [ ] DB result types defined per route file
- [ ] `npm run build`: 0 TypeScript errors
- [ ] `npm test`: 770/770 pass
