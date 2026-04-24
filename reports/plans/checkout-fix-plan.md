# CHECKOUT FIX — TASK BRIEF CHO CLAUDE CODE CLI

**Owner**: Claude Code CLI
**Protocol**: Mekong CLI commands (2-strikes, --minify/--quiet, edit chunk no full rewrite)
**Target**: https://auraspace.cafe/checkout.html
**Stack**: Cloudflare Pages + aura-space-worker + D1
**Cwd**: `/Users/mac/mekong-cli/FnB-Container-Caffe`

---

## 0. KNOWN BUGS (từ session trước — đã fix local, chưa deploy prod)

- CSS MIME error: `checkout.css` → `checkout-styles.css?v=2.2.1`
- Form submit GET query leak: `type="submit"` → `type="button"` + `preventDefault()`
- Payment cards bị tắt khi chọn "Đặt Giờ": scope handler `[data-time]` vs `[data-method]`
- Giỏ hàng trống: `_persistCart()` chưa gọi trong `addToCart`/`changeQty`, thêm rồi
- Key mismatch: checkout đọc `aura_cart`, menu ghi `aura_cart_v1` — đảo thứ tự priority
- formData keys: JS đọc `name/phone/email/address/notes`, HTML có `customerName` — rename
- `loadCartToSummary` wipe `#btnPay`: render vào `#summaryItems` (child), không `#orderSummary` (parent)
- Label/autocomplete console issues: đã thêm
- CSP eval: MetaMask extension noise (không phải code mình)

---

## 1. PLAN EXECUTION ORDER

### Phase 1 — Regression Gate (trước khi ship)

```
/qa-regression
```

Expect ✓ on: cart key `aura_cart_v1`, CSS version `?v=2.2.1`, form preventDefault, data-method/data-time scoping, formData key rename. Nếu FAIL → `/dev-bug-sprint <fail-item>`.

### Phase 2 — Cart Persistence Deep-Check

```
/aura-cart-debug
```

Verify code paths tồn tại:
- `Grep "_persistCart\(\)" menu.html` → ≥ 2 hits (addToCart + changeQty)
- `Grep "aura_cart_v1" js/ menu.html checkout.html` → ≥ 3 hits
- `Grep "loadCartFromAPI" js/checkout.js` → normalize `qty || quantity`

Nếu miss: `/dev-bug-sprint "missing cart persist call in <file:line>"`.

### Phase 3 — OAuth / Auth Flow Check

```
/sec-scan
```

Verify:
- `Grep "autoFillCheckoutForm" js/auth.js` → fallback `#fullName` → `#customerName`
- `Grep "jwtAuth\|requireAuth" worker/src/` → admin routes protected
- `Grep "auth_token\|admin_token" js/ worker/src/` → không trộn lẫn

Nếu thấy route `/api/admin/*` thiếu middleware → `/backend-api-build "add jwtAuth('admin') to <route>"`.

### Phase 4 — Local Review

```
/review
```

Check git diff chưa commit. Block on: new inline eval, hardcoded secrets, missing preventDefault, full-file rewrite > 500 lines.

### Phase 5 — E2E Smoke (pre-ship)

```
/qa-e2e
```

Expect tất cả 7 probes 200. Nếu `/css/checkout-styles.css` ≠ 200 hoặc Content-Type ≠ `text/css` → STOP, fix trước.

### Phase 6 — Ship to Production

```
/ship "fix: checkout flow — cart persist, CSS MIME, form submit, payment scoping, OAuth fallback"
```

Pipeline: git status → node -c worker → commit → push → `wrangler deploy --minify` → `wrangler pages deploy . --project-name=fnb-caffe-container --commit-dirty=true` → verify.

Output target: `worker=<ver> | pages=<hash>.fnb-caffe-container.pages.dev | sha=<short>`.

### Phase 7 — Post-Ship Verify (30s sau deploy)

```
/ops-health
```

7 probes cần 200: `/`, `/menu.html`, `/checkout.html`, `/admin/login.html`, `/api/health`, `/css/checkout-styles.css`, + cart persistence code present in `/menu.html` source.

```
/obs-logs --status=error
```

Tail 30s, expect zero error liên quan checkout/OAuth.

### Phase 8 — Incident Rollback Plan (nếu fail)

```
/rollback both
```

Worker: `wrangler rollback <previous-version-id>` (lấy từ Phase 6 output).
Pages: dashboard revert (hoặc `git checkout <prev-sha> -- . && /pages-deploy`).

---

## 2. STOP CONDITIONS (CLAUDE.md 2-strikes)

- Cùng 1 lỗi fail 2 lần liên tiếp → DỪNG, báo cáo format:
  ```
  [FILE:LINE] — <phân tích vì sao local fix không giải quyết>
  <suggested next approach cần human>
  ```
- Không tự loay hoay lần 3.

---

## 3. DELIVERABLES

- Prod URL: https://auraspace.cafe/checkout.html hoạt động end-to-end
- Worker version ID mới
- Pages deployment URL mới
- Report path: `reports/devops/deploy/deploy-YYYY-MM-DD_HHMM.md`
- Commit SHA trên `main`

---

## 4. NOTES CHO CC CLI

- Token hygiene: mọi lệnh `wrangler` dùng `--minify` / `--quiet`; mọi `npm/pip` dùng `--silent` (CLAUDE.md #3)
- Không tự sáng tạo workflow mới — chain 7 commands trên theo thứ tự, mỗi lệnh có sẵn trong `.claude/commands/`
- Khi `/ship` pass nhưng `/ops-health` fail → `/incident-respond "checkout 500 after deploy"` → `/rollback both`
