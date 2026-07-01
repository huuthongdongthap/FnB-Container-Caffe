---
phase: 4
title: "TypeScript :any Cleanup — Hono Context Types"
status: pending
priority: P0
effort: 2h
dependencies: []
---

# Phase 4: TypeScript `:any` Cleanup — Context Types

## Overview

Fix the most common `:any` pattern: Hono route handlers typed as `(c: any) =>`. Replace with proper `Context<{ Bindings: Env }>` types. This is the highest-impact change — affects categories.ts, products.ts, subscriptions.ts, and all inline handler functions.

## TDD Contract

1. Tests lock current behavior
2. Replace `(c: any) =>` with proper type
3. Fix any TypeScript errors that surface
4. Run tests — must stay green

## Work Items

### File: `products.ts` — 5 handlers using `(c: any)`

**Current:**
```typescript
productsRouter.post('/', async (c: any) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json();
```

**Fix:**
```typescript
import type { Env } from '../types/env';
import type { Context } from 'hono';

productsRouter.post('/', async (c: Context<{ Bindings: Env }>) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json();
```

### File: `categories.ts` — 5 handlers using `(c: any)`

Same pattern as products.ts — replace `(c: any)` with `Context<{ Bindings: Env }>`.

### File: `subscriptions.ts` — 12+ handlers using `(c: any)`

Replace all `(c: any)` and `body = await c.req.json<any>()` with proper types.

### File: `admin-loyalty.ts` — admin handlers

Check and replace any `(c: any)` occurrences.

### Other files with Context-as-any patterns

Grep for `async (c: any)` and `(c: any) =>` across all route files. Fix each.

## Pattern

| Before | After |
|--------|-------|
| `async (c: any) => {` | `async (c: Context<{ Bindings: Env }>) => {` |
| `(c: any) => {` | `(c: Context<{ Bindings: Env }>) => {` |

## Files Changed

- `worker/src/routes/products.ts`
- `worker/src/routes/categories.ts`
- `worker/src/routes/subscriptions.ts`
- `worker/src/routes/admin-loyalty.ts` (if applicable)
- Any other route with `(c: any)`

## Validation

```bash
npm run build  # 0 TypeScript errors
npm test       # all tests pass
```

## Success Criteria

- [ ] Zero `(c: any)` in route handler signatures
- [ ] `npm run build`: 0 TypeScript errors
- [ ] `npm test`: all tests pass
