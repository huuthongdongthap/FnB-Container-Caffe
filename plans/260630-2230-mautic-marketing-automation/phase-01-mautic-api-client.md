# Phase 01 — Mautic API Client (TDD)

**Status:** complete
**Priority:** High
**TDD:** ✅ Write tests first, then implement (27 tests)

## Overview

Create a Mautic REST API client library for Cloudflare Workers. Handles OAuth2 Client Credentials authentication, contact CRUD, segment management, and campaign enrollment.

## Key Insights (from research)

- OAuth2 Client Credentials flow: `POST /oauth/v2/token` with `grant_type=client_credentials`
- Token cached in memory (no refresh token — re-auth on expiry)
- Contact `email` is de facto unique key; use `{phone}@aura-cafe.internal` for phone-only customers
- PATCH for partial updates (PUT clears unspecified fields)
- Segments: manual membership via `/segments/{id}/contact/{contactId}/add`
- Campaign enrollment: `POST /campaigns/{id}/contact/{contactId}/add`
- FastCGI gotcha: `access_token` in POST body as fallback if Authorization header stripped

## Requirements

### Functional
- OAuth2 authentication with token caching + auto-refresh
- Create/update contacts (single + batch)
- Add contacts to segments
- Enroll contacts in campaigns
- Custom field support (phone, loyalty_tier, last_order_date, birthday)

### Non-functional
- Retry with exponential backoff on network errors
- No `console.log` — use structured logger
- Token cache: in-memory, refresh on 401
- Batch size: 50 contacts per batch request

## Architecture

```
MauticClient class
├── constructor(baseUrl, clientId, clientSecret)
├── authenticate() → accessToken
├── createOrUpdateContact(contact) → contactId
├── batchUpsertContacts(contacts[]) → results[]
├── addContactToSegment(contactId, segmentId)
├── addContactToCampaign(contactId, campaignId)
└── _request(method, path, body) → Response (with retry)
```

## Implementation Steps (Complete)

1. [x] Write 6+ TDD tests for MauticClient (27 written)
2. [x] Implement OAuth2 `authenticate()` with token caching + expiry buffer
3. [x] Implement `_request()` with retry + error handling + FastCGI body-token fallback
4. [x] Implement `createOrUpdateContact()` + `batchUpsertContacts()`
5. [x] Implement `addContactToSegment()` + `addContactToCampaign()`
6. [x] Verify all 27 tests pass, 0 build errors

## Files

- **NEW:** `worker/src/lib/mautic-client.js`
- **NEW:** `tests/mautic-client.test.js`

## Success Criteria (All Met)

- [x] OAuth2 token obtained and cached in-memory with expiry buffer
- [x] Contact create/update works (single + batch 50) with phone-only email fallback
- [x] Segment membership add works via `/api/segments/{id}/contact/{id}/add`
- [x] Campaign enrollment works via `/api/campaigns/{id}/contact/{id}/add`
- [x] Retry on 5xx errors, no retry on 4xx (except 401), FastCGI body-token fallback
- [x] 27 TDD tests pass, 0 build errors
- [x] Custom error classes: MauticError, MauticAuthError, MauticNetworkError
- [x] Factory function `createMauticClient()` returns null when env vars missing

## Risk

- Mautic API version differences between self-hosted versions
- FastCGI header stripping may require POST body fallback
- Batch API limits (test with 50, adjust down if needed)
