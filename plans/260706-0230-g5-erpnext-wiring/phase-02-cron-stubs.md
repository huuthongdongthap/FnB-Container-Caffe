# Phase 2: Cron Stubs → Real Implementation
**Estimate:** 2h
**Deps:** Phase 1 (needs working `syncOrderToERPNext`)

## Context
`worker/src/routes/cron.ts` l.15-23 có 2 stub:
- `processErpnextRetryQueue` — log "not configured, skipping" → return 0
- `processErpnextProductSync` — log "not configured, skipping" → return 0

Không retry failed ERPNext syncs. Không delta sync products.

## Requirements
1. **Retry queue:** Đọc `erpnext_sync_log` từ D1 (status='failed', retry_count < MAX_RETRIES), retry mỗi entry, cập nhật log
2. **Product sync:** Gọi `erpnext-product-client.ts` delta sync (changed since last_sync_at), update tracking
3. Giữ fire-and-forget — failure không throw lên caller
4. MAX_RETRIES = 3, exponential backoff (1h, 4h, 16h)
5. Register both in ScheduledController trong `index.ts`

## Files to Modify
- `worker/src/routes/cron.ts` — implement real bodies cho 2 functions
- `worker/src/index.ts` — verify cron registration

## Tests (TDD)
- Test retry queue picks up failed entries, skips max-retry entries
- Test product sync respects last_sync_at boundary
- Test both functions swallow errors (never throw)

## Validation
- `npm run build` 0 errors
- Tests pass
- Verify cron schedule exists in index.ts
