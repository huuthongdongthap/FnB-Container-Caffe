# Huong Dan Trien Khai / Deployment Guide

> Huong dan tung buoc cho nguoi van hanh khong chuyen ky thuat.
> Step-by-step guide for non-technical operators.

---

## 1. Platform

**Cloudflare Workers + Cloudflare Pages**

| Component | URL | Ghi chu / Note |
|-----------|-----|----------------|
| Pages Production | `https://fnb-caffe-container.pages.dev` | Frontend (Vite build) |
| Custom Domain | `https://auraspace.cafe` | Tro den Cloudflare Pages |
| Worker Production | (Wrangler deploy) | API backend |

---

## 2. Moi Truong Preview / Preview Environments

Cloudflare Pages tu dong tao preview cho moi branch ma ban push len.
(Cloudflare Pages auto-deploys a preview for every pushed branch.)

### Mau URL / URL Pattern

`https://{branch-name}.fnb-caffe-container.pages.dev`

**Vi du / Examples:**

| Branch Name | Preview URL |
|-------------|-------------|
| `main` | `https://main.fnb-caffe-container.pages.dev` |
| `feature/new-menu` | `https://feature-new-menu.fnb-caffe-container.pages.dev` |
| `fix/bug-123` | `https://fix-bug-123.fnb-caffe-container.pages.dev` |

> **Luu y:** Cloudflare Pages thay `/` bang `-` va viet thuong toan bo.
> (Cloudflare Pages replaces `/` with `-` and lowercases everything.)

### Cach Kiem Tra / How to Test

1. Push branch len GitHub: `git push origin feature/ten-branch`
2. Doi 1-2 phut cho Cloudflare build xong (Wait 1-2 min for build)
3. Mo URL preview o tren (Open the preview URL)
4. API Worker van dung Worker production (API still uses production Worker)

---

## 3. Trien Khai Thu Cong / Manual Deploy

### Yeu Cau / Prerequisites

- Node.js 18+
- Da login Cloudflare: `npx wrangler login`
- Da `git push` commit moi nhat (Already pushed latest commit)

### Len Co Ban / Basic Command

```bash
bash deploy-cloudflare.sh
```

Chay tu repo root. Script se: (Run from repo root. It will:)
1. Build frontend voi Vite
2. Deploy frontend len Cloudflare Pages
3. Deploy Worker (API) va pass `GIT_COMMIT_SHA`

### Cac Co / Available Flags

| Flag | Tac Dung / Effect |
|------|-------------------|
| `--worker-only` | Chi deploy Worker, bo qua Pages (Deploy Worker only, skip Pages) |
| `--pages-only` | Chi deploy Pages, bo qua Worker (Deploy Pages only, skip Worker) |
| `--skip-tests` | Bo qua buoc chay test truoc khi deploy (Skip pre-deploy test gate) |
| `--skip-migrations` | Bo qua D1 migrations — day la hanh vi mac dinh (Skip D1 migrations — default fail-closed behavior) |
| `--migration-file=<name.sql>` | Chi ap dung 1 file forward migration cu the trong `worker/db/migrations/` (Apply a single explicit forward migration) |
| `--skip-verify` | Bo qua kiem tra health/SHA sau deploy (Skip post-deploy verification) |

**Vi du / Example:**
```bash
bash deploy-cloudflare.sh --worker-only
bash deploy-cloudflare.sh --worker-only --migration-file=20261010_01_modifier_option_contract_columns.sql
```

> **Ghi chu:** Deploy mac dinh KHONG tu dong chay lai toan bo migration lich su (fail-closed) de bao ve du lieu live tren D1.

---

## 4. Kiem Tra Sau Deploy / Post-Deploy Verification

Sau khi deploy, kiem tra cac endpoint sau:
(After deploy, check these endpoints:)

### Health Check

```
GET https://auraspace.cafe/api/health
```

**Phan hoi / Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-07-02T...",
  "uptime": 123456,
  "d1": "connected"
}
```

Dau hieu tot: `status` la `"ok"`, `d1` la `"connected"`.
(Good sign: `status` is `"ok"`, `d1` is `"connected"`.)

### Version Check (SHA)

```
GET https://auraspace.cafe/api/version
```

**Phan hoi / Response:**
```json
{
  "shortSha": "a1b2c3d4",
  "fullSha": "a1b2c3d4e5f6...",
  "environment": "production"
}
```

So sanh `shortSha` voi commit vua push de xac nhan ban dung dang duoc deploy.
(Compare `shortSha` with your just-pushed commit to confirm the right build is live.)

---

## 5. Database Migrations (D1)

Cloudflare D1 migration duoc ap dung thu cong voi ten file tuong minh (fail-closed, khong chay hang loat):
(Cloudflare D1 migrations are applied manually with an explicit filename — fail-closed, never bulk-replayed:)

```bash
# Tu repo root (From repo root):
bash worker/scripts/apply-migrations.sh --file YYYYMMDD_NN_description.sql

# Hoac truc tiep voi Wrangler tu thu muc worker/ (Or directly via Wrangler from worker/):
cd worker
npx wrangler d1 execute fnb-caffe-db --remote --file=db/migrations/YYYYMMDD_NN_description.sql
```

**Luu y:** Chay migration truoc hoac sau deploy -- khong anh huong toi availability vi Worker xu-ly gracefully.
(Run migrations before or after deploy -- no downtime since Worker handles missing columns gracefully.)

---

## 5b. Rollback (3-Tier / Chinh Sach Rollback 3 Tang)

Chinh sach rollback chinh thuc la **Option B1 — 3-tier rollback** — KHONG dua vao
cac file `.down.sql`. 30/37 migration hien tai chua co `.down.sql`, va 7 file co san
bi đanh dau nguy hiem mat du lieu. Viec tu che `.down.sql` co `DROP TABLE` se pha huy
du lieu live, vi vay khong hang thu 3 rollback qua down-migration.
(Official rollback policy is **Option B1 — 3-tier rollback**, deliberately NOT based
on `.down.sql` files. 30/37 migrations lack a `.down.sql` and the 7 that exist are
flagged hazardous (table-drop data-loss risk). Fabricating `DROP TABLE` down-migrations
would destroy live data, so tier 3 is never a down-migration.)

### Tang 1 — Cloudflare Pages (Frontend) / Tier 1

Rollback deployment cu nhat qua Pages Rollback API:

```bash
curl -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/fnb-caffe-container/deployments/${DEPLOYMENT_ID}/rollback" \
  -H "Authorization: Bearer ${CF_API_TOKEN}"
```

Lay `DEPLOYMENT_ID` tu Cloudflare Dashboard > Workers & Pages > `fnb-caffe-container` >
Deployments. (Get `DEPLOYMENT_ID` from the Cloudflare Dashboard deployments list.)

### Tang 2 — Cloudflare Worker (API) / Tier 2

```bash
npx wrangler rollback <VERSION_ID> --config worker/wrangler.toml
```

Lay `<VERSION_ID>` tu `npx wrangler deployments list --config worker/wrangler.toml`.

### Tang 3 — Cloudflare D1 `fnb-caffe-db` / Tier 3

Uu tien phuc hoi du lieu bang point-in-time recovery (PITR):

```bash
npx wrangler d1 time-travel restore fnb-caffe-db --bookmark="<BOOKMARK_ID>"
```

Neu schema thay doi (khong phai data loss), viet **forward-fix SQL** migration moi thay vi
down-migration. Down-migration chi la phuong sap cuoi cung va phai duoc owner phe duyet
truc tiep.
(Recover data first via PITR. If a schema change needs reverting, write a new
forward-fix migration rather than a down-migration. A down-migration is a last
resort requiring explicit owner approval.)

### Quy tac bao mat / Safety Rules

- **KHONG** tu dong rollback D1 trong script deploy. (Never auto-rollback D1 in deploy scripts.)
- **KHONG** chay `deploy-cloudflare.sh --migration-file` khi đang rollback.
  (Do not apply a forward migration while rolling back.)
- Xac nhan sau rollback: `GET /api/health` va `GET /api/version` (kiem tra `shortSha`).
  (Verify after rollback via `/api/health` and `/api/version`.)

---

## 6. Cau Hinh Moi Truong / Environment Config

### Variables (set in `wrangler.toml` hoac / or Cloudflare Dashboard)

| Variable | Gia Tri / Value |
|----------|----------------|
| `ENVIRONMENT` | `production` |
| `CORS_ORIGIN` | `*` |
| `JWT_EXPIRY_SECONDS` | `604800` |
| `SLA_THRESHOLD_MINUTES` | `15` |

### Secrets (set via CLI -- KHONG commit / DO NOT commit)

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put PAYOS_CLIENT_ID
npx wrangler secret put PAYOS_API_KEY
npx wrangler secret put PAYOS_CHECKSUM_KEY
```

### Proxy (Mac/Linux)

Tat proxy truoc khi deploy de tranh loi network:
(Unset proxy before deploy to avoid network errors:)
```bash
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy
```

---

## 7. CORS Preview URLs

Cloudflare Workers da duoc cau hinh CORS cho phep preview URL:
(Workers are pre-configured with CORS allowing preview URLs:)

- `https://fnb-caffe-container.pages.dev` (production)
- `https://{branch}.fnb-caffe-container.pages.dev` (preview)
- `https://auraspace.cafe` (custom domain)
- `http://localhost:*` (local dev)

---

**Tai lieu cap nhat / Doc updated:** 2026-10-21
