# GenerateQR CI Test Failure — Root Cause Analysis

**Date:** 2026-08-14 19:13 (Asia/Saigon)
**Test:** `src/pages/admin/__tests__/GenerateQR.test.tsx`
**CI Error:** `toHaveTextContent('QR Codes')` → received `'qrCodes.pageTitle'`

## Root Cause

`vi.resetModules()` + dynamic `import()` in `beforeEach` breaks mock resolution under CI coverage instrumentation.

### Why CI fails, local passes

1. `test-setup.ts` pre-loads real `react-i18next` (line 6: `import { initReactI18next }`)
2. `vi.resetModules()` clears module cache
3. Dynamic `import('@/pages/admin/GenerateQR')` re-resolves modules
4. CI runs `--coverage` flag → changes code transformation timing
5. Mock for `react-i18next` not re-applied → component gets real `useTranslation`
6. Real i18next has no `admin` namespace → returns raw key `qrCodes.pageTitle`

### Pattern mismatch

Every other admin test (Customers, Staff, Broadcast, etc.) uses:
- Static `import` (not dynamic)
- No `vi.resetModules()` in `beforeEach`

GenerateQR is the only test using `vi.resetModules()` + dynamic import pattern.

## Fix

Replace dynamic import with static import. Remove `vi.resetModules()`.

```ts
// Before (broken in CI)
let Page: React.ComponentType<any>;
beforeEach(async () => {
  vi.resetModules();
  const mod = await import('@/pages/admin/GenerateQR');
  Page = mod.default;
});

// After (matches codebase pattern)
import GenerateQRPage, { QrCard } from '@/pages/admin/GenerateQR';
// No vi.resetModules() needed
```

## Unresolved Questions

None — root cause confirmed, fix is straightforward.
