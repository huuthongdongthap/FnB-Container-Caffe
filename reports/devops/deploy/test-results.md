# Smoke Test Results — Production Post-Deploy Verification (`2026-11-23T08:40:03Z`)

## 1. Live Worker API & Readiness Probes
| Endpoint | HTTP | Verified Result | Status |
|---|---|---|---|
| `GET https://aura-space-worker.sadec-marketing-hub.workers.dev/api/health` | `200` | `{"status":"ok","version":"27a04144","liveness":true,"readiness":true}` | PASS |
| `GET https://aura-space-worker.sadec-marketing-hub.workers.dev/api/health?ready=1` | `200` | `{"status":"ok","version":"27a04144","d1":"connected","dependencies":{"d1_database":{"status":"healthy","latencyMs":24}}}` | PASS |
| `GET https://aura-space-worker.sadec-marketing-hub.workers.dev/api/version` | `200` | `{"shortSha":"27a04144","fullSha":"27a041441fd41c73dcede0794be609021404ca1f","environment":"production"}` | PASS |
| `GET /api/products` | `200` | `{"success":true,"data":[...]}` (`49` products, `21,504` bytes) | PASS |
| `GET /api/tables` | `200` | `{"success":true,"data":[...]}` (`12` tables, statuses `Available`/`Reserved`) | PASS |
| `GET /api/loyalty/rewards` (unauth) | `401` | Fail-closed auth guard | PASS |
| `GET /api/admin/orders` (unauth) | `401` | Fail-closed RBAC guard | PASS |
| `GET /api/admin/customers` (unauth) | `401` | Fail-closed RBAC guard | PASS |
| `GET /api/shifts/payouts` (unauth) | `401` | Fail-closed shift actor guard | PASS |
| `GET /api/shifts/reconciliations` (unauth) | `401` | Fail-closed shift reconciliation guard | PASS |

## 2. Live Custom Domain (`https://auraspace.cafe`) SPA & Asset Probes
| Endpoint | HTTP | Verified Result | Status |
|---|---|---|---|
| `GET https://auraspace.cafe/version.json` | `200` | `{"sha":"27a041441fd41c73dcede0794be609021404ca1f","shortSha":"27a04144","buildTime":"2026-11-23T08:37:47Z","deployScript":"deploy-cloudflare.sh"}` | PASS |
| `GET https://auraspace.cafe/` | `200` | Serves `assets/index-Bz78vSCj.js` (matches `27a04144` Vite build) | PASS |
| `GET https://auraspace.cafe/menu` | `200` | SPA route reachable | PASS |
| `GET https://auraspace.cafe/pos` | `200` | SPA route reachable | PASS |
| `GET https://auraspace.cafe/kds` | `200` | SPA route reachable | PASS |
| `GET https://auraspace.cafe/admin/login` | `200` | SPA route reachable | PASS |
| `GET https://auraspace.cafe/robots.txt` | `200` | Static SEO asset reachable | PASS |
| `GET https://auraspace.cafe/sitemap.xml` | `200` | Static SEO asset reachable | PASS |

## 3. Pre-Deploy CI Gate Summary (`main` run `45137756849` on `27a04144`)
- `lint-and-test` → `SUCCESS`
- `e2e-smoke` → `SUCCESS`

## Unresolved Questions
- None.
