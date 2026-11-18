# Smoke Test Results — Lượt 9 Pre-Cutover & Live Production Baseline

## 1. Local Loopback & Contract Smoke Gates (Converged Worktree)
| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | PASS (0 errors, 0 warnings) |
| Migration Lint | `npm run lint:migrations` | PASS (60 forward / 18 down in `worker/db/migrations`, 87 forward total) |
| Contrast (WCAG AA) | `npm run check:contrast` | PASS (11/11 pairs) |
| Typecheck | `npm run typecheck:all` | PASS (frontend + worker + aura-deploy) |
| Unit & Integration Suite | `npx vitest run` | PASS (577 files, 5,763 tests) |
| Live Worker Loopback | `node scripts/local-payment-flow/run.mjs --api-only` | PASS (58/58 checks, `fatal: false`) |
| Deployment Contract | `npx vitest run worker/src/__tests__/integrations/deployment-contract.test.ts` | PASS (11/11 tests) |

## 2. Live Production Endpoint Baseline Probes (`2026-11-18T09:49:06Z`)
| Endpoint | HTTP | Payload / Status |
|---|---|---|
| `GET https://aura-space-worker.sadec-marketing-hub.workers.dev/api/health` | `200` | `{"status":"ok","liveness":true,"readiness":true}` |
| `GET https://aura-space-worker.sadec-marketing-hub.workers.dev/api/health?ready=1` | `200` | `{"status":"ok","d1":"connected","dependencies":{"d1_database":{"status":"healthy","latencyMs":12}}}` |
| `GET https://aura-space-worker.sadec-marketing-hub.workers.dev/api/version` | `200` | `{"shortSha":"unknown","fullSha":"unknown","environment":"production"}` |
| `GET https://auraspace.cafe` | `200` | SPA shell served |

## Unresolved Questions
- Post-cutover `/api/version` SHA parity probe will run once `worker-canary-10` and `deploy-pages` are dispatched.
