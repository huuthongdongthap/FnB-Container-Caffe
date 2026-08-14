# Phase 9: Admin Test Coverage Expansion (Optional)

**Priority:** P2 | **Status:** TODO | **Effort:** 4-6h

---

## Context

Admin test coverage is at10/25+ (40%). This phase expands coverage to18/25+ (72%) by adding tests for untested admin pages.

## Target Pages (10 untested)

| Page | LOC | Priority |
|------|-----|----------|
| NotificationSettings.tsx | 581 | P1 |
| Staff.tsx | 558 | P1 |
| PromotionsManager.tsx | 510 | P1 |
| Customers.tsx | ~400 | P2 |
| Analytics.tsx | ~350 | P2 |
| Reservations.tsx | ~300 | P2 |
| Settings.tsx | ~250 | P2 |
| Integrations.tsx | ~200 | P3 |
| AuditLog.tsx | ~200 | P3 |
| SystemHealth.tsx | ~150 | P3 |

## Test Pattern

Follow established i18n mock pattern:

```typescript
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, opts?: Record<string, unknown>) => {
      if (!key) return '';
      let text = MOCK_FALLBACK[key] ?? key;
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          text = text.replaceAll(`{{${k}}}`, String(v));
        }
      }
      return text;
    },
  }),
}));
```

## Expected Output

- 10 new test files
- 50-80 new tests
- All passing

## Success Criteria

-18/25+ admin pages tested (72%)
- All 2914+ tests still pass
- 0 TS errors

## Note

This phase is optional. If Sprint 7+8 are time-constrained, defer this to a later sprint.
