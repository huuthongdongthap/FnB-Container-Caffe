# Phase 2b-3c: Campaigns + Loyalty + Zalo (9 files, P1)

## Already Tested (loyalty)
- `process-order.ts` — `__tests__/tree/loyalty/process-order.test.ts`
- `helpers.ts` — `__tests__/tree/loyalty/helpers.test.ts`
- `spend-cashback-handler.ts` — `__tests__/tree/loyalty/spend-cashback-handler.test.ts`
- `summary-handler.ts` — `__tests__/tree/loyalty/summary-handler.test.ts`
- `lookup-handler.ts` — `__tests__/tree/loyalty/lookup-handler.test.ts`
- `campaign.ts` — `__tests__/tree/loyalty/campaign.test.ts`

## Campaigns — Files to Test
| Source | Lines | Test File |
|--------|-------|-----------|
| `src/tree/campaigns/campaign-engine.ts` | 62 | `__tests__/tree/campaigns/campaign-engine.test.ts` |
| `src/tree/campaigns/templates.ts` | 109 | `__tests__/tree/campaigns/templates.test.ts` |
| `src/tree/campaigns/types.ts` | 45 | `__tests__/tree/campaigns/types.test.ts` |

*Note: cron-handler.ts (194L) deferred — deeply coupled to inngest, test at route level instead.*

## Loyalty — Files to Test
| Source | Lines | Test File |
|--------|-------|-----------|
| `src/tree/loyalty/auth-middleware.ts` | 32 | `__tests__/tree/loyalty/auth-middleware.test.ts` |
| `src/tree/loyalty/phone-auth-handler.ts` | 118 | `__tests__/tree/loyalty/phone-auth-handler.test.ts` |

## Zalo — Files to Test
| Source | Lines | Test File |
|--------|-------|-----------|
| `src/tree/zalo/notify-member.ts` | 41 | `__tests__/tree/zalo/notify-member.test.ts` |
| `src/tree/zalo/zns-sender.ts` | 68 | `__tests__/tree/zalo/zns-sender.test.ts` |

*Note: zns-templates.ts (42L) already tested in task #18.*
*Note: types.ts (26L) — type-only file, test via import check or skip.*

## Test Strategy
- campaign-engine: trigger evaluation logic with fixture customer data
- templates: template rendering with mock variables
- auth-middleware: JWT validation, reject/accept flows
- phone-auth-handler: OTP flow, mock SMS/http
- notify-member: mock HTTP call to zalo API
- zns-sender: mock fetch, template variable substitution

## Acceptance
- All 5 new test files created and passing
- `npx vitest run` passes
