# Phase 01: Worker Tree, Integrations, Clients & Durable Objects

## Overview
- Priority: High
- Current status: In Progress
- Description: Harden cryptographic operations, prevent storage bloat in Durable Objects, add resilient fallbacks in campaign triggers, fix ZNS template definitions, and ensure accurate subscription period calculations.

## Requirements
- QR verification must reject non-finite timestamps (`NaN`) and compare HMAC digests in constant time.
- Durable Object `OrderBroadcaster` must bound stored orders to prevent exceeding Cloudflare DO 128 KB single-key limits, roll back in-memory state on storage failures, and handle WebSocket upgrades in `fetch()`.
- Campaign triggers must fall back gracefully between canonical and legacy campaign log schemas.
- ZNS notification service must define all valid template names without throwing runtime errors.
- Subscription month calculations must use UTC arithmetic to prevent month-end date rollover bugs.

## Related Code Files
- `worker/src/tree/qr/signer.ts`
- `worker/src/do/OrderBroadcaster.ts`
- `worker/src/tree/campaigns/triggers/birthday.ts`
- `worker/src/tree/campaigns/triggers/welcome.ts`
- `worker/src/tree/campaigns/triggers/winback.ts`
- `worker/src/tree/campaigns/triggers/post-visit.ts`
- `worker/src/tree/zalo/zns-templates.ts`
- `worker/src/tree/channels/zalo.ts`
- `worker/src/tree/subscriptions/helpers.ts`
- `worker/src/tree/subscriptions/sub-handlers.ts`
- `worker/src/tree/analytics/mrr-calculator.ts`
- `worker/src/routes/erpnext.ts`

## Implementation Steps
1. Update `verifyQRSignature` in `worker/src/tree/qr/signer.ts` to validate finite numbers and use constant-time XOR comparison.
2. In `worker/src/do/OrderBroadcaster.ts`, prune terminal orders past limit, catch storage rejections to rollback state, and implement `fetch()` WebSocket upgrade.
3. Add try/catch column fallbacks in `birthday.ts`, `welcome.ts`, `winback.ts`, and `post-visit.ts`.
4. Define missing templates in `zns-templates.ts` and handle fallback mappings in `zalo.ts`.
5. Fix date arithmetic in `helpers.ts` and ensure `paused_at` timestamp is set in `sub-handlers.ts`.
6. Fix annual/quarterly MRR normalization in `mrr-calculator.ts`.

## Success Criteria
- All cryptographic signatures verified in constant time.
- Durable Object persists state reliably without exceeding size limits.
- Full unit test pass across tree, subscriptions, and integrations.
