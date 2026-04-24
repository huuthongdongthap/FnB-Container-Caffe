# BRAND GUIDELINE PUBLISH — TASK BRIEF CHO CLAUDE CODE CLI

**Owner**: Claude Code CLI
**Protocol**: Mekong CLI commands (2-strikes, --minify/--quiet, edit chunk no full rewrite)
**Target**: https://auraspace.cafe/brand-guideline.html (currently 404 due to .cfignore block on docs/)
**Stack**: Cloudflare Pages
**Cwd**: `/Users/mac/mekong-cli/FnB-Container-Caffe`

---

## 0. ROOT CAUSE

- `.cfignore` line 15 chứa `docs` → cả folder `docs/` bị loại khỏi Pages upload
- `docs/brand-guideline.html` tồn tại trong repo nhưng KHÔNG lên production
- Giữ nguyên `.cfignore` (tránh leak api-audit.md, backend-proposals.md, QWEN_AUTONOMOUS_PIPELINE.md, CART-CHECKOUT-AUDIT.md, loyalty-cashback-schema.md)

---

## 1. PLAN EXECUTION ORDER

### Phase 1 — Pre-flight Audit

```
/qa-regression
```

Không strict — chỉ baseline. Không được FAIL existing checks.

### Phase 2 — Git Move + Path Fix

Single commit, 2 ops:

```
git mv docs/brand-guideline.html brand-guideline.html

sed -i.bak \
  -e 's|\.\./css/brand-tokens\.css|css/brand-tokens.css|g' \
  -e 's|\.\./assets/brand/|assets/brand/|g' \
  -e 's|\.\./index\.html|index.html|g' \
  brand-guideline.html

rm brand-guideline.html.bak
```

Verify: `grep -n '\.\./' brand-guideline.html` → expect 0 hits (trừ HTML escaped `&lt;` code block).

**Lưu ý**: file có 1 code sample line ~920 hiển thị literal `<link rel="stylesheet" href="css/brand-tokens.css" />` — đây là code block HTML-escaped, KHÔNG phải real ref. Không động vào.

### Phase 3 — Add Short URL Redirect

Edit `_redirects`, thêm dòng dưới section existing:

```
/brand            /brand-guideline.html  200
/brand-guideline  /brand-guideline.html  301
```

Verify: `tail -5 _redirects` hiển thị đủ.

### Phase 4 — Local Review

```
/review
```

Expect diff:
- 1 rename `docs/brand-guideline.html` → `brand-guideline.html`
- 3 path replacements trong brand-guideline.html
- 2 lines thêm `_redirects`

Block on: file thay đổi > 10 (chỉ nên có rename + 2 edit).

### Phase 5 — Ship to Production

```
/ship "feat(brand): publish brand-guideline at root — fix .cfignore block on docs/"
```

Pipeline: git commit → push → `wrangler pages deploy . --project-name=fnb-caffe-container --commit-dirty=true`.

Worker KHÔNG deploy (không đổi worker code) — expect pipeline skip worker step hoặc no-op.

Output target: `pages=<hash>.fnb-caffe-container.pages.dev | sha=<short>`.

### Phase 6 — Post-Ship Verify

```
curl -sI -o /dev/null -w "brand-guideline.html: %{http_code} ct:%{content_type}\n" https://auraspace.cafe/brand-guideline.html

curl -sI -o /dev/null -w "short /brand: %{http_code}\n" https://auraspace.cafe/brand

curl -s https://auraspace.cafe/brand-guideline.html | grep -c 'brand-tokens.css'

curl -sI -o /dev/null -w "docs still blocked: %{http_code}\n" https://auraspace.cafe/docs/brand-guideline.html
```

Expect:
- brand-guideline.html: 200 text/html
- /brand: 200 (rewrite) hoặc 301 (redirect)
- grep brand-tokens: ≥ 1 (CSS ref còn đó)
- docs/brand-guideline.html: 404 (security posture giữ nguyên)

```
/ops-health
```

Expect không regression.

### Phase 7 — Incident Rollback (nếu fail)

```
/rollback pages
```

Hoặc manual: `git revert <commit-sha> && /pages-deploy`.

---

## 2. STOP CONDITIONS (CLAUDE.md 2-strikes)

- Nếu Phase 6 `brand-guideline.html` ≠ 200 sau 2 lần deploy → DỪNG, report:
  ```
  [brand-guideline.html] — <cloudflare pages upload log / cache issue>
  <suggested next approach cần human>
  ```
- Nếu `docs/brand-guideline.html` thành 200 (accidentally public toàn bộ docs) → ROLLBACK ngay, `.cfignore` đã bị vô tình sửa.

---

## 3. DELIVERABLES

- URL live: https://auraspace.cafe/brand-guideline.html → 200
- URL short: https://auraspace.cafe/brand → 200 (rewrite) hoặc redirect
- Pages deployment hash mới
- Commit SHA trên main
- Report: `reports/devops/deploy/brand-publish-YYYY-MM-DD_HHMM.md`

---

## 4. NOTES CHO CC CLI

- KHÔNG sửa `.cfignore` — giữ nguyên security posture
- KHÔNG wholesale remove `docs` khỏi cfignore — chỉ move 1 file cần public
- Token hygiene: `wrangler pages deploy` không cần `--minify` (Pages không bundle), nhưng dùng `--commit-dirty=true` để tránh git check
- Không tự chạy Phase 8 cleanup (remove .bak files) — sed đã xử lý
- Nếu sed không work trên macOS (GNU vs BSD sed syntax khác): fallback dùng `sed -i '' ...` (BSD syntax)
