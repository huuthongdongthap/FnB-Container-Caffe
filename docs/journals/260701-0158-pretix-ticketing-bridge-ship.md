# Pretix Event Ticketing Bridge: Pillar 7/12 Shipped After Critical HMAC Fix

**Date**: 2026-07-01 01:58
**Severity**: High
**Component**: Pretix Event Ticketing Bridge (FnB Pillar 7/12)
**Status**: Resolved (commit 065deae)

## What Happened

Pillar 7 of the Aura Cafe Container ecosystem is complete. A Cloudflare Worker bridge now connects to a self-hosted pretix instance (Python/Django, AGPL) for event ticketing -- 6 endpoints covering event listing, order retrieval, check-in, e-ticket generation, and webhook receipt. 25 new tests, 814 total suite, 0 failures.

The code-reviewer agent caught a critical security problem during review: HMAC-SHA256 webhook verification was a format check only, not a real cryptographic verification.

## The Brutal Truth

The HMAC bug is the kind of security theater that makes me wince. The code checked that the `X-Pretix-Webhook-Signature` header existed and looked like a hex string, then accepted the webhook unconditionally. Any attacker who knew the endpoint URL could forge webhook events -- order confirmations, cancellations, refunds -- and the system would process them. Five lines of code that gave the illusion of security. The format string regex was `^sha256=[0-9a-f]{64}$`, which validates the shape of a signature but never actually computes one.

This is a failure of the "simulate first, secure second" approach. The validation placeholder was written during the fast prototyping phase with the intention to "come back and wire it up properly." We didn't. We shipped without testing the security boundary.

The review also caught 3 other issues: the check-in SQL had a bare column name (`event_name`) that would have been ambiguous in a JOIN context, JSON parsing lacked a safe fallback so a malformed request body would throw an uncaught exception, and list ID coercion from the webhook payload had wrong typing that would have silently failed for organization-scoped webhooks.

## Technical Details

**Fix 1 -- HMAC-SHA256 verification (CRITICAL)**
- File: `worker/src/routes/pretix.js`
- Original: checked `req.headers.get('X-Pretix-Webhook-Signature')` format only, then passed through
- Fix: real `crypto.subtle.verify()` using `HMAC` algorithm with `PRETIX_WEBHOOK_SECRET` as key, hashing raw body bytes, comparing against decoded hex from the header
- Without this: anyone with knowledge of the webhook URL could trigger fake order events

**Fix 2 -- event_name column ambiguity (HIGH)**
- File: `worker/src/db/pretix-queries.js`
- `INSERT INTO checkins` had `event_name` without table qualification
- Fix: fully qualified with correct column and value binding

**Fix 3 -- Unsafe JSON.parse (HIGH)**
- File: `worker/src/routes/pretix.js`
- `JSON.parse(body)` on webhook body could throw on malformed input
- Fix: wrapped in try/catch with appropriate error response

**Fix 4 -- List ID type coercion (MEDIUM)**
- File: `worker/src/routes/pretix.js`
- Webhook payload `list` field arrives as string or number depending on trigger context
- Fix: parseInt with fallback to preserve downstream DB insert

**Test suite**: 25 new tests covering all 6 endpoints, error paths, webhook signature verification (valid + invalid + missing), bad JSON body, missing fields.

## What We Tried

No failed remediation -- all four issues were caught during code review of the initial implementation, before any production deployment. The fixes were applied, tests written, and verified in a single iteration.

## Root Cause Analysis

1. **Security shortcut pattern**: Placeholder validation marked with "TODO: implement real check" is indistinguishable from no validation. The HMAC stub was written in the first implementation pass, reviewed by the same developer, and never revisited. Code reviews must flag any security-relevant code that uses placeholder logic -- especially crypto.

2. **LEFT JOIN blind spot**: The `event_name` column is on the `events` table, but in a raw SQL query with multiple joined tables, an unqualified column reference is silently ambiguous. SQLite accepts it (resolving to the first match), but the semantics are wrong. This is a class of bug that tests with single-table data won't catch -- you need a multi-row JOIN test to see the wrong value populate.

3. **Webhook payload shape uncertainty**: The pretix webhook API sends different payload shapes depending on the event type and organization configuration. The `list` field arrives as integer, string, or absent. Without defensive parsing, an organization-scoped webhook would crash the handler before any logging occurred.

## Lessons Learned

- Security boundaries must be verified in tests, not in a checklist. A test that sends a forged signature and expects HTTP 401 would have caught the HMAC stub immediately.
- Raw SQL queries with JOINs must qualify every column. No exceptions. This should be a lint rule.
- Webhook handlers must parse defensively at the boundary, not at the point of use. Parse the body to a typed structure, validate all fields with defaults, then use the validated object downstream.
- "I'll wire it up later" is a lie we tell ourselves. If security code is worth writing, it's worth writing completely in the same PR.

## Next Steps

- Pillar 7 complete. 5 pillars remain on the roadmap (~75h estimated).
- Remaining line: OpenWISP (WiFi management), TastyIgniter (restaurant POS), Home Assistant (building automation), Frigate (NVR), and ERPNext (ERP -- blocked pending upstream integration decision).
- The HMAC test pattern (valid signature, invalid signature, missing signature) should become a template for all future webhook integrations in this project.
