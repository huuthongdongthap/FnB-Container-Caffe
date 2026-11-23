# Pre-Flight Checklist — Production Deploy `main` (`27a04144`)

- [x] **Target Ref:** `origin/main` = `27a041441fd41c73dcede0794be609021404ca1f` (includes PR `#145` UAT `#111`–`#138` integrity hardening + PR `#146` Playwright pre-existing spec fixes)
- [x] **Repo Hygiene:** `0` open PRs, `0` open issues, clean working tree in detached HEAD at exact `origin/main` (`HEAD == origin/main == origin/HEAD`)
- [x] **Hosted CI (`main` run `45137756849` on `27a04144`):** `lint-and-test=SUCCESS`, `e2e-smoke=SUCCESS`
- [x] **Cloudflare Auth & Account:** OAuth active (`b69fee03bdd94234eea8e4114cfc36ab`), Worker secrets intact (`JWT_SECRET`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, `PAYOS_CLIENT_ID`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`; flagship `PAYOS_*` isolated from SaaS billing)
- [x] **D1 Schema Parity (`fnb-caffe-db` / `97ae7a5f-fc4d-460d-b019-8535332bd81f`):**
  - `git diff --name-only 37e9b80b..origin/main -- worker/db/migrations/ worker/migrations/ worker/wrangler.toml` = empty (0 new migrations)
  - Verified remote D1 DDL contains `cash_payouts` (with `tenant_id`), `cash_payment_attributions`, `cashback_transactions` (with `balance_after`, `tenant_id`), `idx_reconciliation_tenant_shift_unique`, `orders.cashback_used`, `orders.loyalty_points_redeemed`, `payment_refund_transfers`, `refund_loyalty_work`, `refund_mutation_guards`, `refund_tenant_readiness`
  - Fail-closed default applied: `0` remote D1 migrations executed
- [x] **Rollback Handles Captured Pre-Deploy:**
  - Previous Worker Version ID: `44babe91-1e5f-42fd-b3cb-a6590b0c74fb` (`37e9b80b`)
  - Previous Pages Deployment ID: `32a30b2e-f0f8-41f7-907e-1fe8f4b5608e` (`37e9b80`)
- [x] **Cloudflare Pages Deployed:** `dc5dc3b5-9bb3-4deb-b709-be7dcd978d31` (`https://dc5dc3b5.fnb-caffe-container.pages.dev` → `https://auraspace.cafe`, `shortSha: 27a04144`)
- [x] **Cloudflare Worker Deployed:** `aura-space-worker` Version ID `97385200-3bd6-474d-83ee-9965ab819070` (`shortSha: 27a04144`, 100% traffic)
