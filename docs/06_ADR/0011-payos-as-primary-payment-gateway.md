# ADR 011: Use PayOS as Primary Payment Gateway

**Date:** 2026-03-12  
**Status:** Accepted  
**Decision Maker:** Founder / Finance

## Context

We needed a payment gateway for Vietnam that:
- Supports QR code payments (VietQR standard)
- Integrates with Cloudflare Workers (serverless)
- Has reasonable fees (< 3%)
- Provides production-ready API and webhooks
- Supports both online and in-store payments

Alternatives:
1. **PayOS**: Vietnam-based, QR code, good API, ~2.5% fee
2. **VNPay**: Bank gateway, higher integration complexity
3. **MoMo**: E-wallet only, limited to MoMo users
4. **SePay**: QR code, newer service
5. **Stripe**: Not available in Vietnam (only international cards)

## Decision

Chose **PayOS** as primary gateway.

## Consequences

### Positive
- ✅ **VietQR standard**: Works with all Vietnamese bank apps
- ✅ **Good API**: RESTful, well-documented
- ✅ **Webhooks**: Real-time payment confirmation
- ✅ **Production-ready**: Used by many Vietnamese merchants
- ✅ **Reasonable fees**: 2.5% per transaction
- ✅ **Sandbox environment**: For testing

### Negative
- ⚠️ **Vendor lock-in**: Migration to other gateway requires code changes
- ⚠️ **API key management**: Must keep PayOS credentials secure
- ⚠️ **Webhook reliability**: Must handle retries, idempotency
- ⚠️ **Customer experience**: Requires bank app to scan QR (cashless but not card)

### Risks
- **PayOS downtime**: Would block payments — have COD as fallback
- **API changes**: PayOS updates API with breaking changes — pin version, monitor changelog
- **Settlement delays**: T+1 or T+2 for funds to reach bank account — cashflow planning needed

## Mitigations

- **Fallback**: COD always available as backup
- **Monitoring**: Alert on webhook failures > 5% rate
- **Testing**: Sandbox environment for all changes before production

## Why Not Others?

- **VNPay**: Requires merchant account at partner bank, more complex integration
- **MoMo**: Only MoMo users (40% market share), excludes others
- **Stripe**: No Vietnam domestic support (only international cards)

## Future Considerations

- Add MoMo as secondary gateway (capture MoMo-only customers)
- Implement smart routing based on customer's bank (if detectable)

## Implementation

- Client secret: `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` (Cloudflare secrets)
- Webhook verification: HMAC-SHA256 signature check
- Idempotency: Use PayOS `paymentLinkId` as unique order reference

## Related

- Payment routes: `worker/src/routes/payment.js`
- Webhook verification: `worker/src/routes/webhooks.js`
- Config: `worker/src/config.js`
- See `CEO-HANDOVER.md` section 7 for payment flow operator guide
