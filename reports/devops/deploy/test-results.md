# Smoke Test Results — Lượt 9 Post-Deployment Verification (`2026-11-18T09:57:19Z`)

## 1. Live Production Smoke Probes
| Endpoint | HTTP | Verified Payload | Status |
|---|---|---|---|
| `GET https://aura-space-worker.sadec-marketing-hub.workers.dev/api/health` | `200` | `{"status":"ok","version":"8bbc93c8","liveness":true,"readiness":true}` | PASS |
| `GET https://aura-space-worker.sadec-marketing-hub.workers.dev/api/health?ready=1` | `200` | `{"status":"ok","version":"8bbc93c8","d1":"connected","dependencies":{"d1_database":{"status":"healthy","latencyMs":24}}}` | PASS |
| `GET https://aura-space-worker.sadec-marketing-hub.workers.dev/api/version` | `200` | `{"shortSha":"8bbc93c8","fullSha":"8bbc93c8417b1572b2a471eb0fd12488a6ff7d2c","environment":"production"}` | PASS |
| `GET https://aura-space-worker.sadec-marketing-hub.workers.dev/api/menu` | `200` | Menu catalog JSON payload | PASS |
| `GET https://auraspace.cafe/version.json` | `200` | `{"sha":"8bbc93c8417b1572b2a471eb0fd12488a6ff7d2c","shortSha":"8bbc93c8","buildTime":"2026-11-18T09:56:21Z","deployScript":"deploy-cloudflare.sh"}` | PASS |

## 2. Pre-Deploy Local Gate Summary
- `npm run lint` → PASS
- `npm run lint:migrations` → PASS (60 forward / 18 down in `worker/db/migrations`)
- `npm run check:contrast` → PASS (11/11 WCAG AA pairs)
- `npm run typecheck:all` → PASS
- `npx vitest run` → PASS (577 files, 5,763 tests)
- `node scripts/local-payment-flow/run.mjs --api-only` → PASS (58/58 checks)

## Unresolved Questions
- None.
