# Rollback Plan — Lượt 9 Production Deployment

## 1. Worker Instant Rollback (< 60s)
- **Via GitHub Actions:** Run `.github/workflows/deploy.yml` with:
  - `action`: `worker-rollback`
  - `baseline_version_id`: `33d9e23b-711c-4278-82d1-b8013fedc41a`
  - `rollback_reason`: `Rollback Lượt 9 canary`
- **Via CLI:**
  ```bash
  cd worker && npx wrangler rollback 33d9e23b-711c-4278-82d1-b8013fedc41a --message "Rollback Lượt 9" --yes
  ```

## 2. D1 Schema Rollback
- Forward migrations `20261115_01` and `20261118_01` are additive (`ADD COLUMN`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) and backward-compatible with baseline Worker `33d9e23b-711c-4278-82d1-b8013fedc41a`.
- If full D1 state restoration is required, restore from the pre-migration artifact `d1-backup-pre-migration-<run_id>` or D1 Time Travel bookmark captured before `apply-d1-migration`.

## 3. Unresolved Questions
- Confirm whether to push and trigger `apply-d1-migration` + `worker-canary-10` on production now.
