---
title: "Phase 05 — Staging Documentation"
description: "Document Cloudflare Pages preview URLs and branch-based staging environments"
status: pending
priority: P3
effort: 1h
phase: 05
depends_on: []
blocks: []
---

## Overview

Update `docs/deployment-guide.md` with Cloudflare Pages preview environment documentation. Cloudflare Pages automatically deploys preview environments for every branch matching the pattern `*.<project>.pages.dev`. This gives the team a staging-like experience without any additional configuration.

## Current State

**File:** `docs/deployment-guide.md` — may or may not exist. Need to check.

The CORS allowlist in `worker/src/index.ts:77-83` already permits preview URLs:
```typescript
/^https:\/\/fnb-caffe-container\.pages\.dev$/,
/^https:\/\/[a-z0-9-]+\.fnb-caffe-container\.pages\.dev$/,
```

This is the preview URL pattern Cloudflare Pages uses: `{branch-name}.{project-name}.pages.dev`.

## Requirements

- Document the Pages preview URL pattern: `https://{branch-name}.fnb-caffe-container.pages.dev`
- Document the Pages production URL: `https://fnb-caffe-container.pages.dev`
- Document the Worker staging URL pattern (if applicable)
- Document how to test against staging/preview environments
- Document the deploy script flags (`--skip-tests`, `--skip-migrations`, `--skip-verify`)
- Keep bilingual (VN + EN) if existing docs are bilingual

## Implementation Steps

### Step 1: Check existing documentation

Read `docs/deployment-guide.md` to understand existing structure.

If it doesn't exist, check `docs/` for any deployment-related docs:
```bash
ls /Users/macbook/FnB-Container-Caffe/docs/
```

### Step 2: Add staging section to `docs/deployment-guide.md`

Add a section covering:

**Cloudflare Pages Preview Environments:**
```markdown
## Staging / Preview Environments

Cloudflare Pages tự động deploy môi trường preview cho từng branch.
[Cloudflare Pages automatically deploys preview environments for every branch.]

### Preview URL Pattern

- **Mẫu URL:** `https://{branch-name}.fnb-caffe-container.pages.dev`
- **Production:** `https://fnb-caffe-container.pages.dev`
- **Custom domain:** `https://auraspace.cafe`

### How to Test a Feature Branch

1. Push branch lên GitHub: `git push origin feature/my-feature`
2. Cloudflare Pages tự động build và deploy preview
3. Mở preview URL: `https://feature-my-feature.fnb-caffe-container.pages.dev`
4. Worker production vẫn được dùng chung (Worker không có preview tách biệt)

### Branch Naming Rules for Preview URLs

Cloudflare Pages replaces `/`, `_`, and uppercase letters in branch names:
- `feature/my-feature` → `feature-my-feature.fnb-caffe-container.pages.dev`
- `fix/bug-123` → `fix-bug-123.fnb-caffe-container.pages.dev`

### Deploy Script Flags

| Flag | Tác dụng |
|------|----------|
| `--skip-tests` | Bỏ qua `npm test` trước khi deploy |
| `--skip-migrations` | Bỏ qua áp dụng D1 migrations |
| `--skip-verify` | Bỏ qua post-deploy health + SHA check |
| `--worker-only` | Chỉ deploy Worker (không Pages) |
| `--pages-only` | Chỉ deploy Pages (không Worker) |

### CI (GitHub Actions)

GitHub Actions chạy CI (lint + test) tự động trên push/PR.
Deployment được thực hiện THỦ CÔNG qua `bash deploy-cloudflare.sh`.
[GitHub Actions runs CI (lint + test) automatically on push/PR.
Deployment is done MANUALLY via `bash deploy-cloudflare.sh`.]
```

### Step 3: Verify

```bash
# Check that docs build (if docs use any build system)
ls /Users/macbook/FnB-Container-Caffe/docs/
```

## Test Matrix

| Scenario | Expected |
|----------|----------|
| Reader sees preview URL pattern | Clear examples with real branch name |
| Reader sees deploy flags | All 5 flags documented with purpose |
| Bilingual content | VN + EN for each section |
| Links are valid | All referenced URLs resolve |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Docs outdated later | Medium | Low | Deploy script has inline usage comment as source of truth |
| Preview URL pattern changes | Low | Low | Cloudflare pattern is stable |
| No existing docs file | Medium | Low | Create new file if needed |

## Related Files

- `docs/deployment-guide.md` — modify or create
- `deploy-cloudflare.sh` — read only (document flags)
- `worker/src/index.ts:77-83` — reference (CORS allowlist pattern)
