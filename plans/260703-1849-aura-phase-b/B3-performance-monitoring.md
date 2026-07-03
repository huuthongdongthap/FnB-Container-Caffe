# B3: Performance Monitoring & Web Vitals

**Date:** 2026-07-03
**Status:** Planned
**Priority:** P2 Medium
**Source:** docs/05_TASKS/infrastructure.md Story 6 (not implemented)
**Effort:** 4-6 hours
**Dependencies:** B1 (metrics infrastructure for error rate monitoring)
**Blocks:** None

---

## 1. Technical Design

### Problem Statement

No Web Vitals tracking (LCP, FID, CLS), no Lighthouse CI on PRs, no API response time monitoring. Performance degradation goes undetected until users complain.

### Architecture

Three-prong approach: (1) Web Vitals via `web-vitals` library with beacon endpoint, (2) Lighthouse CI via GitHub Actions trigger, (3) API response time monitoring via existing analytics.

```
Sessions:
  Browser ──> web-vitals library ──> POST /api/vitals (beacon)
                    │
  API response times already captured via B1 metrics infrastructure

CI/CD:
  PR merge ──> GitHub Actions ──> Lighthouse CI ──> Score comment on PR
```

### Key Design Decisions

1. **web-vitals library** — Install `web-vitals` npm package for standardized Web Vitals collection. Small bundle (~1KB gzipped).

2. **Beacon endpoint** — `POST /api/vitals` stores measurements in D1 `_metrics` table (reusing B1 infrastructure). Non-blocking sendBeacon.

3. **No new database tables** — Reuse existing `_metrics` table from B1 with name prefix `web_vital_*`.

4. **Lighthouse CI** — GitHub Actions workflow on PRs to `main`. Comment with score breakdown. Not blocking merge (informational only).

5. **Dashboard display** — Add "Performance" tab to existing admin metrics page showing Web Vitals distribution (good/needs-improvement/poor) and recent API p95 latency.

---

## 2. File List

### Files to Create

| File | Purpose |
|------|---------|
| `worker/src/routes/vitals.ts` | `POST /api/vitals` beacon endpoint |
| `.github/workflows/lighthouse.yml` | Lighthouse CI on PR |
| `worker/src/__tests__/routes/vitals.test.ts` | Tests for vitals endpoint |

### Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` or `src/main.tsx` | Initialize `web-vitals` library, beacon on each metric |
| `src/styles/global.css` | Add `content-visibility: auto` on below-fold sections for CLS improvement |
| `src/pages/admin/Metrics.tsx` | Add Performance tab with Web Vitals + API latency display |

---

## 3. Database Changes

None. Reuses `_metrics` table from B1 with naming convention:
- `web_vital_lcp` — Largest Contentful Paint (ms)
- `web_vital_fid` — First Input Delay (ms)
- `web_vital_cls` — Cumulative Layout Shift (score)
- `api_p95_latency` — P95 API response time (ms, from B1 middleware aggregation)

---

## 4. API Endpoints

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/vitals` | Receive Web Vitals beacon from browser | Public (CORS-limited) |
| GET | `/api/admin/metrics?filter=web_vital_*&range=7d` | Query stored vitals (reuses B1 endpoint) | Staff |

---

## 5. Frontend Components

| Component | File | Description |
|-----------|------|-------------|
| WebVitalsInit | `src/main.tsx` | Initialize web-vitals library, beacon callback |
| PerformanceTab | `src/pages/admin/Metrics.tsx` section | Web Vitals distribution bar + API p95 latency chart |

No new component files. Modifications are additive to existing components.

---

## 6. Tests

| Test | File | What to verify |
|------|------|----------------|
| Vitals endpoint | `worker/src/__tests__/routes/vitals.test.ts` | POST `/api/vitals` stores correct metric name/value, validates input shape |
| Lighthouse workflow | Manual trigger | Workflow runs, produces score report |

---

## 7. Acceptance Criteria

### Web Vitals
- [ ] `web-vitals` library initialized in browser session
- [ ] LCP, FID, CLS measurements beacons to `POST /api/vitals`
- [ ] Metrics stored in `_metrics` table with prefix `web_vital_*`
- [ ] Performance tab shows vitals distribution (good/needs-improvement/poor per Google thresholds)

### API Latency
- [ ] P95 latency displayed on dashboard (from B1 middleware metrics)
- [ ] Latency trend over 24h/7d

### Lighthouse CI
- [ ] GitHub Actions workflow exists for PR trigger
- [ ] Score comment posted on PR (informational, non-blocking)
- [ ] Target: Performance >= 90, Accessibility >= 95, Best Practices >= 90, SEO >= 95

### Quality Gates
- [ ] `npm run build` = 0 errors (web-vitals adds type defs)
- [ ] `npm test` = all tests pass
- [ ] Zero `console.log` in production code
- [ ] web-vitals beacon is non-blocking (sendBeacon, not fetch)

---

## 8. Rollback Plan

```bash
# Revert Web Vitals code
git checkout HEAD -- worker/src/routes/vitals.ts src/main.tsx

# Remove Lighthouse workflow
rm .github/workflows/lighthouse.yml
```

---

## 9. Estimated Effort

| Task | Time |
|------|------|
| Install web-vitals, init in main.tsx with beacon | 30 min |
| Build POST /api/vitals endpoint | 30 min |
| Write vitals endpoint tests | 20 min |
| Add Performance tab to admin metrics page | 1h |
| Create Lighthouse CI workflow | 30 min |
| Add content-visibility CSS for CLS | 15 min |
| Build + test verification | 20 min |
| **Total** | **~4h** |
