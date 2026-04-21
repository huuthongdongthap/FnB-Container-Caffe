# CTO Task: Debug Test Failures — 26 fails blocking go-live

> Priority: P0 | Tests: 26 failed, 102 passed, 128 total

## Root Cause Analysis
Tests are grep-based HTML structure checks. C1→C5 refactor likely changed/removed HTML elements that tests expect.

## Failures by File

### 1. `tests/order-system.test.js` — 19 failures
**index.html missing elements** (Order Modal removed during refactor?):
- `id="orderModal"`, `order-modal-content`, `order-modal-overlay`
- `data-tab="menu"`, `data-tab="cart"`, `id="cartCount"`
- `data-cat="coffee"`, `data-cat="signature"`, `data-cat="snacks"`
- `id="cartSubtotal"`, `id="cartDelivery"`, `id="cartTotal"`
- `id="btnCheckout"`

**checkout.html missing elements**:
- `id="checkoutForm"`, `customerName`, `customerPhone`, `customerEmail`, `deliveryAddress`
- `id="ward"`, payment method radios, `id="orderSummary"`
- `id="discountCode"`, `applyDiscountBtn`, `id="submitOrderBtn"`, `id="successModal"`

**checkout.js missing patterns** (code was refactored):
- `validCodes`, `FIRSTORDER`, `WELCOME10`, `SADEC20`, `CONTAINER`
- `percent: 10`, `maxDiscount`

### 2. `tests/order-flow.test.js` — 2 failures
- `success.html`: missing `#4a2c17` theme-color
- `success.html`: missing "Về Trang Chủ" button linking to `index.html`

### 3. `tests/checkout.test.js` — 5 failures
- checkout.html: missing API config, form, payment options, js/css links
- Hint: `<!-- VIEW: FAILURE -->` comments in response → checkout.html may have been replaced

## Fix Strategy

### Option A: Fix HTML (recommended if elements were accidentally removed)
1. `git diff HEAD~3 -- index.html checkout.html success.html` → check what changed
2. Restore missing HTML elements IF they were accidentally deleted
3. Re-run tests

### Option B: Update Tests (if HTML was intentionally refactored)
1. If order modal was intentionally removed from index.html → update test expectations
2. If checkout.html form IDs changed → update test selectors
3. Re-run tests

### Steps
```bash
# 1. Check what changed in HTML files
git diff HEAD~3 -- index.html checkout.html success.html | head -200

# 2. Check if checkout.html still has form (or was replaced)
grep -c "checkoutForm\|customerName\|paymentMethod" checkout.html

# 3. Check if index.html still has order modal
grep -c "orderModal\|cartCount\|cartSubtotal" index.html

# 4. Fix based on findings (Option A or B)

# 5. Re-run tests
npx jest tests/order-flow.test.js tests/order-system.test.js tests/checkout.test.js --verbose 2>&1 | tail -30

# 6. If all pass → proceed with deploy steps from cto-go-live-deploy.md (steps 3→7)
```

## Rules
- Pipe output qua `head` hoặc `tail`
- Option A first (restore HTML), Option B only if intentional change
- Commit: `fix: restore HTML elements for test compliance`
- After tests pass → continue go-live deploy (steps 3→7 from cto-go-live-deploy.md)
