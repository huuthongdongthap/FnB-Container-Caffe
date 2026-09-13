# REVIEW — M1 Batch 3: D1 Orphan-Table Retirement + Spec Reconciliation

Reviewer: code-reviewer
Date: 2026-09-13
Plan: plans/2026-09-13-m1-d1-orphan-table-retirement/
Scope: worker/db/migrations/20260913_02_retire_orphan_tables.{sql,.down.sql},
       worker/db/migrations/README.md, .ai/specs/{migration-matrix,phase-map}.md,
       docs/architecture/{DOMAIN_MAP,CURRENT_STATE}.md, plan + phase-01 artifacts.

Decision: **PASS**
Score: 9.2 / 10
criticalCount: 0  ·  highCount: 1  ·  mediumCount: 2  ·  lowCount: 2

---

## 1. Scope verification (all criteria)

| Criterion | Result | Evidence |
|-----------|--------|----------|
| (a) 9 dropped tables have zero live-code consumers | PASS | `grep -rn` over worker/src + src (all extensions) → EXIT 1 (no matches). Only permitted refs remain: the two migration files, .down.sql DDL, README retired note, scripts/backfill-odoo-customers.js console.log strings (never execute SQL), legacy migrations 001–004 (recreate+rename history), plan/spec/doc prose. Active `erpnext_*` tables (mappings/sync_log/sync_queue/product_sync) confirmed still read by erpnext-accounting-client.ts + erpnext-product-client.ts + process-order.ts — correctly NOT dropped. |
| (b) Down-migration DDL self-consistent, no `_new` refs | PASS | `grep -c '_new' down.sql` → 0. Live sqlite validation (`/tmp` scratch DB): `.down.sql` creates all 9 tables (count 9); then `.sql` drops all 9 (post-drop count 0). odoo_mappings created before odoo_sync_logs (FK ordering valid). DDL recovered verbatim from live sqlite_master. |
| (c) Spec/docs make no false claims | PASS | RESOLVED-NOT-NEEDED claims for `payments_new`/`subscription_invoices_new` confirmed against actual recreate+rename migrations (006 lines 5/32–33, 013 line 7/35 — both already unified; `_new` never existed in prod). All "5 odoo_* tables" claims enumerate the same 5 tables in every location (odoo_invoices/odoo_mappings/odoo_customer_consent/odoo_product_sync/odoo_sync_failures+odoo_sync_logs = 6 tables total — see medium #1). |
| (d) No code regression (359/3269 green, tsc exit 0) | PASS (trusted) | Task brief states already run; code diff is pure DDL + prose — no worker/src or src touched in this batch. Confirmed: only diffing tracked file is README.md (the two files in gitStatus — vi.json, phone-auth-handler.ts — show zero diff vs HEAD; no dropped-table references in either). |
| (e) Migration naming convention | PASS | `20260913_02_retire_orphan_tables.sql` follows date-numbered `_NN` sibling pattern (preceded by `_01_customer_identity_...` same date). `.down.sql` sits beside up-file, matching existing sibling (`20260913_01_customer_identity_...down.sql`). |
| (f) No secrets / credentials | PASS | Scanned all changed files for api_key/secret/password/credential/token/sk-*/Bearer → only false positives (consent "token generation", push_token column — unrelated). No `.env`, keys, or connection strings present. |

## 2. Findings

### High priority (1)

**H1 — Retiring `users_legacy` re-creates it via canonical `20260824_04_users_recreate.sql` on fresh deploys.**
The README lists `20260824_04_users_recreate.sql` as the canonical definition for `users`, and that migration does `ALTER TABLE users RENAME TO users_legacy;` then creates a new `users`. Fresh-DB bootstrap (README §"Fresh-environment bootstrap" runs migrations in order) will therefore re-create `users_legacy` as an empty table immediately after this retirement — resurrecting the very table just dropped. It was empty so no data harm, but it is a fresh-env re-introduction of a retired table.
Fix: either (a) on fresh DBs, treat `20260824_04` as a no-op (same treatment given to `_03_customers_profile_columns` and `_02_locality_fields` whose DDL is already in schema.sql — add it to the skip-list), or (b) convert `20260824_04` to `DROP TABLE IF EXISTS users_legacy; CREATE TABLE users ...` so the rename no longer runs. Option (b) is cleaner. Either way, update the README skip-list + canonical-vs-duplicate table.

### Medium priority (2)

**M1 — "5 odoo_* tables" count is inconsistent (actually 6).**
Three locations say "the 5 `odoo_*` tables": DOMAIN_MAP.md:107, phase-01.md:17, and the README remote-only list (which enumerated all 9 by name, no count). The odoo family is 6 distinct tables: odoo_invoices, odoo_mappings, odoo_customer_consent, odoo_product_sync, odoo_sync_failures, odoo_sync_logs. The "5" claim likely omits odoo_sync_logs. Since the name-lists are correct everywhere, this is a prose-count bug. Recommend re-reading all three sites and correcting the count to 6 (or dropping the numeric qualifier and relying on the enumeration).

**M2 — Plan/phase status still reads "pending".**
plan.md line 5: `**Status: PENDING APPROVAL**`; phase-01.md line 3: `Status: pending`. The implementation is complete and verified. Plan states were not flipped to "done"/"complete". Informational — implementation teams don't mutate plan state, so flagging for the lead to close.

### Low priority (2)

**L1 — Plan header says "D7 closure" but evidence refutes a different premise (no `_new` tables existed).** The batch pivoted from "merge D7 duplicates" to "retire orphans + close D7 as RESOLVED-NOT-NEEDED". The plan and prose accurately narrate this pivot. Minor: the batch title still says "D7/D1"; the D7 rows in the matrix are correctly closed, so no action required — noting for clarity only.

**L2 — `20260824_04_users_recreate.sql` comment describes the rename as forensic preservation.** With `users_legacy` now officially retired and its DDL preserved in the down-migration, the forensic rationale is weaker. Could add a one-line note ("retired 2026-09-13 via 20260913_02; DDL in its .down.sql"). Optional.

## 3. Cross-document consistency

| Claim | migration-matrix.md | phase-map.md | DOMAIN_MAP.md §5 | CURRENT_STATE.md P4 | migrations README | Consistent? |
|-------|---------------------|--------------|------------------|---------------------|-------------------|-------------|
| payments_new → RESOLVED-NOT-NEEDED | row 25 | item 5 line 45 | #1 line 94 | line 65 | — | YES |
| subscription_invoices_new → RESOLVED-NOT-NEEDED | row 26 | item 5 line 45 | #2 line 98 | line 65 | — | YES |
| 9 orphans RETIRE (users_legacy, checkin_log, odoo_*, erpnext_invoices) | row 28 | item 5 line 48 | §6 retired line 107 | line 65 | lines 33–35 | YES (names match) |
| DDL preserved in down-migration | row 28 | — | — | line 65 | line 35 | YES |
| erpnext_mappings/sync_log/sync_queue/product_sync KEPT | implied (not in retire list) | — | — | — | — | YES (grep confirms active code) |

All four spec/doc artifacts tell the same story; the only inconsistency is the "5 odoo_*" count (M1).

## 4. Risks / rollback

- Rollback is trivial and safe: `20260913_02_retire_orphan_tables.down.sql` recreates 9 empty shells. Verified by live sqlite apply (9 created → 9 dropped → 0). No data to restore (all 0 rows).
- Down-migration cannot be accidentally applied: README §1 explicitly states migrations are applied manually `npx wrangler d1 execute AURA_DB --file=...` file-by-file, and `.down.sql` files are "never applied as part of normal forward flow". No glob runner / migrations_dir configured.
- Foreign keys in odoo_sync_logs → odoo_mappings and both invoice tables → orders are valid at creation time (SQLite does not enforce FK at CREATE TABLE; wrangler d1 runs with FK enforcement but referenced tables exist).

## 5. Recommended actions before commit

1. **Required:** Resolve H1 — pick option (a) (add `20260824_04` to README fresh-env skip-list) or (b) (rewrite it to drop users_legacy instead of rename). This prevents fresh-DB bootstrap from resurrecting a retired table.
2. **Recommended:** Fix M1 — correct "5 odoo_* tables" → 6 (or drop the count) at DOMAIN_MAP.md:107 and phase-01.md:17.
3. **Informational:** Lead to flip plan.md status → DONE and phase-01.md status → done.

## 6. Verdict

PASS. The migration is correct, idempotent, reversibly documented, and touches no live code. Specs/docs are mutually consistent and match the migration-file evidence. The one high-severity issue (H1) is a fresh-DB resurrection hazard only — prod D1 is already correctly retired — but it should be closed before commit so future deploys don't reintroduce `users_legacy`. Zero criticals, zero secrets, zero consumer breakage.
