# Mautic Marketing Automation Bridge Completed

**Date**: 2026-06-30 23:41
**Severity**: Low (planned feature, no incident)
**Component**: Marketing Automation (Mautic Bridge)
**Status**: Resolved

## What Happened

Delivered the Mautic Marketing Automation Bridge -- a one-way D1-to-Mautic sync pipeline for customer engagement. 10 new files, 3 modified, 73 TDD tests across 5 suites. All 726 existing tests still pass. Zero build errors.

## The Brutal Truth

This went smoother than expected for a new platform pillar. The OAuth2 implementation was the hardest part -- Mautic's FastCGI body-token workaround is undocumented garbage. But the real kicker is that this is entirely untested against a live Mautic instance. Every integration test uses mocks. We will find bugs the moment someone provisions a real Mautic box and flips the env vars.

## Technical Details

- **MauticClient** (527 lines): OAuth2 Client Credentials with exponential backoff + jitter. FastCGI body-token fallback for weird hosting setups. Contact CRUD, segment/campaign enrollment.
- **Sync Bridge** (598 lines): Batch upsert (50/batch), KV cursor for delta sync, tier segment mapping, dedup by Mautic contact ID.
- **Emails** (96 lines): Resend API, Vietnamese UTF-8, graceful skip if RESEND_API_KEY unset.
- **SMS** (109 lines): SpeedSMS.vn, +84 phone normalization, brandname type.
- **Templates** (99 lines): win-back, birthday, promo -- bilingual Vietnamese/English HTML + SMS.
- **Campaign triggers**: win-back (30d inactivity), birthday (current month), promo (admin-triggered with tier/recency filter).

## Critical Bug Caught in Review

`getTierSegmentKey` returned UPPERCASE keys (BASIC/SILVER/GOLD/PLATINUM). D1 stores tiers in lowercase (bronze/silver/gold/platinum). Would have silently mapped every customer to the wrong segment in production. Fixed with `.toLowerCase()` normalization. This is the kind of bug that goes unfound for weeks because nobody reads the sync results.

## Architecture Decisions

- **One-way bridge** (not bidirectional): Saved ~10h of bidirectional sync complexity. Mautic is source-of-truth for campaign state; D1 is source-of-truth for customer data. No sync conflict resolution needed.
- **Resend + SpeedSMS over Twilio**: $0-6/mo vs $68/mo. Resend free tier covers 3K emails. SpeedSMS at 490 VND/SMS. Pragmatic for a cafe chain.
- **Serialized cron execution**: Sync runs first, then triggers. Prevents duplicate Mautic contacts from concurrent writes.
- **KV cursor on batch success only**: If Mautic is down, cursor does not advance. No data loss on restart.
- **Phone-only fallback**: Customers without email get `{phone}@aura-cafe.internal` as Mautic email key. Works but ugly.

## Lessons Learned

- Case sensitivity between data stores will bite you. Add a normalization helper at the boundary from day one.
- OAuth2 for self-hosted Mautic is a wasteland of half-documented workarounds. Budget extra time for auth integration testing when the instance is available.
- Mock tests are fine for logic coverage but cannot catch API contract mismatches. This bridge needs a real integration smoke test before the first campaign runs.

## Next Steps

- Provision Mautic instance (Docker on VPS or Raspberry Pi)
- Configure env vars: MAUTIC_BASE_URL, MAUTIC_CLIENT_ID, MAUTIC_CLIENT_SECRET, MAUTIC_CAMPAIGN_*, MAUTIC_SEGMENT_*, RESEND_API_KEY, SPEEDSMS_API_KEY
- Create Mautic campaigns (win-back, birthday, promo) and segments
- Set up Cal.com account + event type + webhook for manual trigger
- Write integration smoke test against live Mautic
- Owned by: platform team, no firm timeline
