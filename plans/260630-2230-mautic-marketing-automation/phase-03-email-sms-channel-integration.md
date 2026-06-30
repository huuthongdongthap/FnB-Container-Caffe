# Phase 03 — Email + SMS Channel Integration (TDD)

**Status:** complete
**Priority:** Medium
**TDD:** ✅ Write tests first, then implement (21 tests)

## Overview

Add Resend (email) and SpeedSMS (SMS) channel clients. These are used by Mautic campaigns via webhook actions or directly by Worker campaign triggers.

## Channel Details

### Email — Resend
- Provider: Resend (resend.com)
- Free tier: 3,000/month (100/day) — sufficient for cafe
- API: `POST https://api.resend.com/email` with Bearer token
- UTF-8 / Vietnamese: native support
- Template: HTML string in Worker code (no build step needed)

### SMS — SpeedSMS.vn
- Provider: SpeedSMS (speedsms.vn)
- Cost: 490 VND/SMS flat rate across all carriers
- API: `POST https://api.speedsms.vn/index.php/sms/send` with Basic Auth
- Unicode support for Vietnamese diacritics
- Brandname SMS available (requires business docs)

## Requirements

### Functional
- `sendEmail(to, subject, html)` via Resend API
- `sendSMS(phone, message)` via SpeedSMS API
- Template helpers for campaign message types (win-back, birthday, promo)
- Vietnamese template content with customer name interpolation
- Error logging (no throw on send failure — campaigns continue)

### Non-functional
- API keys stored as CF Worker secrets (env vars)
- Graceful degradation: if API key missing, log + skip (don't crash cron)
- No blocking — fire-and-forget for individual sends within batch

## Implementation Steps (Complete)

1. [x] Write 3+ TDD tests for Resend client (9 tests including templates)
2. [x] Write 3+ TDD tests for SpeedSMS client (12 tests)
3. [x] Implement `worker/src/lib/resend-client.js` — Bearer auth, timeout, graceful degradation
4. [x] Implement `worker/src/lib/speedsms-client.js` — Basic auth, phone normalization, brandname type
5. [x] Implement message templates (`worker/src/lib/campaign-templates.js`) — win-back, birthday, promo variants
6. [x] Verify all 21 tests pass, build clean

## Files

- **NEW:** `worker/src/lib/resend-client.js`
- **NEW:** `worker/src/lib/speedsms-client.js`
- **NEW:** `worker/src/lib/campaign-templates.js`
- **NEW:** `tests/resend-client.test.js`
- **NEW:** `tests/speedsms-client.test.js`

## Success Criteria (All Met)

- [x] Resend email sends with Vietnamese UTF-8 content (verified in test: Giảm 20%, Chúc Mừng Sinh Nhật)
- [x] SpeedSMS sends to +84 numbers (phone normalization: 0xx → 84xx, +84xx → 84xx)
- [x] Templates: win-back, birthday, promo variants (each returns { subject, html, sms })
- [x] Missing API key handled gracefully (returns `{ success: false, skipped: true }`, no crash)
- [x] 21 TDD tests pass, 0 build errors

## Risk

- SpeedSMS requires business registration for brandname SMS (use generic number as fallback)
- Resend free tier daily limit (100/day) — queue and retry if exceeded
- Zalo ZNS already done — reuse existing `zalo.js` (no new work needed)
