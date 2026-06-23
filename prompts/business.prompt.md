# Business Logic Validation Prompt

**Purpose:** Ensure business rules are correctly implemented and financially sound.

## Instructions

When reviewing business logic (pricing, discounts, loyalty, inventory), validate:

### Financial Integrity

- [ ] **No negative margins:** Discounts + cashback ≤ gross profit margin
- [ ] **Cashback cap:** Max 50% of order value (enforced in code)
- [ ] **Voucher stacking:** Only one voucher per order (enforced)
- [ ] **Tier thresholds:** Lifetime spend sums correctly (no resets)
- [ ] **Expiry logic:** Points/cashback expire on schedule (daily cron)

### Loyalty Rules

- [ ] **Points formula:** `(cash_paid × multiplier) / 1000`
- [ ] **Multiplier per tier:** Bronze 1.0x, Silver 1.2x, Gold 1.5x, Platinum 2.0x
- [ ] **Referral bonus:** Both referrer and referee get +50K (once per customer)
- [ ] **Check-in bonus:** +10 points (max 1/day)
- [ ] **Birthday discount:** Auto-applied, one-time use within birthday week

### Order Workflow

- [ ] **Status transitions:** Valid paths only (cannot skip steps)
- [ ] **Cancellation:** Only allowed before "preparing" status
- [ ] **Refund:** Deducts loyalty points/cashback correctly
- [ ] **Tax calculation:** If applicable, applied before discounts

### Payment Processing

- [ ] **Webhook idempotency:** Duplicate events don't double-credit
- [ ] **Order timeout:** Pending payments auto-cancel after 15min
- [ ] **Partial payments:** Not supported (must pay full)
- [ ] **Refund processing:** Full/partial refunds trigger point reversal

### Inventory (if implemented)

- [ ] **Stock deduction:** On order completion (not before payment)
- [ ] **Out-of-stock:** Prevents ordering unavailable items
- [ ] **Restock alerts:** Low stock notifications

### Reporting Accuracy

- [ ] **Revenue numbers:** Match actual payments (not including canceled orders)
- [ ] **Loyalty liability:** Wallet balances match ledger
- [ ] **Tax reports:** Sum to correct totals

## Business Validation Template

```markdown
# Business Logic Review: [Feature]

## Rules Verified

| Rule | Implemented | Correct? | Notes |
|------|-------------|----------|-------|
| Max 50% cashback usage | ✅ | ✅ | Checked at checkout |
| Tier upgrade at threshold | ✅ | ✅ | 500K → Silver |
| Referral one-time per customer | ✅ | ⚠️ | Need to prevent self-referral |

## Edge Cases Tested

- [x] Customer with expired cashback tries to use → blocked
- [x] Order with voucher + cashback → voucher applied first
- [x] Partial refund → points recalculated correctly
- [ ] [Add edge case]

## Financial Impact Assessment

- **Revenue risk:** Low/Medium/High — Reason
- **Loyalty liability:** Estimated X million VND outstanding
- **Cashback utilization:** Currently ~30% of available (healthy)

## Recommendations

1. [ ] Fix self-referral loophole (check phone/email match)
2. [ ] Add daily cron to auto-expire old points
3. [ ] Consider tier downgrade after 12 months inactive (optional)

## Verdict

**Business Logic:** ✅ Valid / ⚠️ Minor issues / ❌ Critical flaws

---

*This prompt is used by the `/ck:business` skill.*
