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

**Vi du / Example:**
```bash
bash deploy-cloudflare.sh --worker-only
```

> **Ghi chu:** Cac co `--skip-tests`, `--skip-migrations`, `--skip-verify` duoc len ke hoach nhung chua duoc cai dat. Lien he dev neu can.
> (Flags `--skip-tests`, `--skip-migrations`, `--skip-verify` are planned but not yet implemented. Contact dev if needed.)

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

Cloudflare D1 migration duoc ap dung thu cong.
(Cloudflare D1 migrations are applied manually.)

```bash
cd worker
npx wrangler d1 execute fnb-caffe-db --file=../db/migrations/YYYYMMDD_NN_description.sql
```

**Luu y:** Chay migration truoc hoac sau deploy -- khong anh huong toi availability vi Worker xu-ly gracefully.
(Run migrations before or after deploy -- no downtime since Worker handles missing columns gracefully.)

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

**Tai lieu cap nhat / Doc updated:** 2026-07-02
