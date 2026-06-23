# Business Logic Validation Prompt

**Purpose:** Validate business rules, financial calculations, and domain logic correctness.

**Context:**
You are validating business logic for {PROJECT_NAME}, a {BUSINESS_DOMAIN} system. Focus area: {SPECIFIC_AREA}.

**Instructions:**

Review the business logic against these validation criteria:

---

## 1. Financial Integrity

### Revenue Calculations
- [ ] All revenue streams accounted for
- [ ] Pricing logic matches business model
- [ ] Taxes calculated correctly
- [ ] Discounts/commissions applied properly
- [ ] Refund handling correct
- [ ] No rounding errors (use integer math where currency)

### Cost Calculations
- [ ] Cost of goods sold (COGS) accurate
- [ ] Variable costs identified
- [ ] Fixed costs allocated correctly
- [ ] Margin calculations correct

**Example validation:**
```
If order = {ORDER_EXAMPLE}
Then revenue = {EXPECTED_REVENUE}
And COGS = {EXPECTED_COGS}
And gross margin = {EXPECTED_MARGIN}%
```

---

## 2. Domain Rules

### Loyalty/Rewards (if applicable)
- [ ] Tier thresholds correct (Bronze: {BRONZE_MAX}, Silver: {SILVER_MIN}-{SILVER_MAX}, etc.)
- [ ] Points accrual rate: {POINTS_RATE} points per {UNIT}
- [ ] Points redemption rate: {REDEMPTION_RATE} points per currency unit
- [ ] Referral rewards: {REFERRAL_REWARD} for referrer and referee
- [ ] Check-in rewards: {CHECKIN_REWARD} points per day
- [ ] Expiration policy enforced ({EXPIRATION_PERIOD})

### Order Workflow
- [ ] Status transitions valid (allowed: {ALLOWED_TRANSITIONS})
- [ ] Cancellation rules: {CANCELLATION_RULES}
- [ ] Modification allowed until: {MODIFICATION_CUTOFF}
- [ ] Inventory reservation timing

### Reservation System
- [ ] Table capacity limits enforced
- [ ] No double-booking allowed
- [ ] Time slot duration: {SLOT_DURATION} minutes
- [ ] Hold time before release: {HOLD_TIME} minutes

---

## 3. Regulatory Compliance

### Tax Compliance
- [ ] Tax rates per jurisdiction: {TAX_RATES}
- [ ] Tax-inclusive vs exclusive handling
- [ ] E-invoicing requirements (if applicable): {EINVOICING_REQUIREMENTS}
- [ ] Receipt generation compliant

### Data Protection
- [ ] PII storage consent obtained
- [ ] Data retention policy enforced ({RETENTION_PERIOD})
- [ ] Right to deletion implemented
- [ ] No unnecessary data collection

---

## 4. Edge Cases & Boundary Conditions

Test these scenarios:

| Scenario | Expected Behavior | Actual Behavior | Pass? |
|----------|-------------------|-----------------|-------|
| {EDGE_CASE_1} | {EXPECTED_1} | {ACTUAL_1} | ✅/❌ |
| {EDGE_CASE_2} | {EXPECTED_2} | {ACTUAL_2} | ✅/❌ |
| {EDGE_CASE_3} | {EXPECTED_3} | {ACTUAL_3} | ✅/❌ |

---

## 5. Business Rule Examples

Walk through these real-world scenarios:

### Scenario 1: {EXAMPLE_1_DESCRIPTION}
**Given:** {GIVEN_1}
**When:** {WHEN_1}
**Then:** {THEN_1}

**Validation:** Does the code produce this result?

---

## 6. Consistency Checks

- [ ] Same calculation logic used consistently across codebase
- [ ] Currency precision consistent (2 decimals?)
- [ ] Timezone handling consistent
- [ ] Rounding rules consistent (floor, ceil, round-half-up)
- [ ] Error messages consistent and helpful

---

## Output Format

```markdown
# Business Logic Validation: {AREA}

**Validation Date:** {DATE}
**Validator:** {YOUR_NAME}
**Status:** {PASS|FAIL|CONDITIONAL_PASS}

## Summary
{BRIEF_SUMMARY}

## Validation Results

### ✅ Passed
- {PASSED_CHECK_1}
- {PASSED_CHECK_2}

### ❌ Failed
- {FAILED_CHECK_1}
  - Issue: {DESCRIPTION}
  - Location: {FILE}:{LINE}
  - Expected: {EXPECTED}
  - Actual: {ACTUAL}
  - Impact: {IMPACT}
  - Recommendation: {FIX}

### ⚠️ Needs Review
- {NEEDS_REVIEW_1} (insufficient context)
- {NEEDS_REVIEW_2} (requires business input)

## Financial Sanity Check
{SANITY_CHECK_RESULTS}

## Recommendations
1. {RECOMMENDATION_1}
2. {RECOMMENDATION_2}

## Questions for Business Owner
- {QUESTION_1}
- {QUESTION_2}
```

---

**Important:** Business logic bugs can be costly. Validate calculations with manual examples. When in doubt, ask domain experts.
