# Phase 2b-3d: Mautic + Final Gate (10 files, P2)

## Files to Test
| Source | Lines | Test File |
|--------|-------|-----------|
| `src/tree/mautic/client-factory.ts` | 15 | `__tests__/tree/mautic/client-factory.test.ts` |
| `src/tree/mautic/campaign-enrollment.ts` | 64 | `__tests__/tree/mautic/campaign-enrollment.test.ts` |
| `src/tree/mautic/enrollment-tracker.ts` | 35 | `__tests__/tree/mautic/enrollment-tracker.test.ts` |
| `src/tree/mautic/sync-state.ts` | 14 | `__tests__/tree/mautic/sync-state.test.ts` |
| `src/tree/mautic/bridge-handler.ts` | 41 | `__tests__/tree/mautic/bridge-handler.test.ts` |
| `src/tree/mautic/campaign-detection.ts` | 95 | `__tests__/tree/mautic/campaign-detection.test.ts` |
| `src/tree/mautic/contact-mapper.ts` | 17 | `__tests__/tree/mautic/contact-mapper.test.ts` |
| `src/tree/mautic/promo-campaign.ts` | 45 | `__tests__/tree/mautic/promo-campaign.test.ts` |
| `src/tree/mautic/segment-sync.ts` | 70 | `__tests__/tree/mautic/segment-sync.test.ts` |
| `src/tree/mautic/contact-sync.ts` | 81 | `__tests__/tree/mautic/contact-sync.test.ts` |
| `src/tree/mautic/contact-sync-cron.ts` | 83 | `__tests__/tree/mautic/contact-sync-cron.test.ts` |
| `src/tree/mautic/types.ts` | 52 | `__tests__/tree/mautic/types.test.ts` |

## Test Strategy
All files interact with external Mautic API via fetch. Strategy:
- Mock `fetch` globally via `vi.stubGlobal('fetch', mockFn)`
- `client-factory.ts`: test URL normalization, auth header construction
- `campaign-enrollment`/`segment-sync`/`contact-sync`: mock Mautic JSON responses, assert HTTP method + URL + body
- `sync-state`: pure state machine, inline assertions
- `types`: type guards via value-of assertions (no `:any`)
- `contact-mapper`: field mapping, assert output shape

## Final Gate Checklist
After all 4 phases complete:
- [ ] `npx vitest run` → 897-927 tests, 0 failures
- [ ] `npx tsc --noEmit` exits 0
- [ ] `git diff --stat` shows only new `__tests__/` files
- [ ] No `:any` types introduced in tests
- [ ] No `console.*` in test files
