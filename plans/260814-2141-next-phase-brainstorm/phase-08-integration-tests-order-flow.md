# Phase 8: Integration Tests — Order Flow E2E

**Priority:** P1 | **Status:** TODO | **Effort:** 4-6h

---

## Context

Current test coverage is component-level (unit tests). The critical revenue path — menu browsing → cart → checkout → payment → order → KDS — lacks cross-component integration testing. This phase adds E2E-style integration tests that verify the complete order lifecycle.

## Test File

`src/__tests__/order-flow-integration.test.tsx`

## Test Scenarios

### 1. Menu Browse → Add to Cart
- Load categories from API
- Render product cards with prices
- Click "Add to Cart" → cart count updates
- Cart persists across navigation

### 2. Cart State Management
- Add multiple items → total calculates correctly
- Remove item → total recalculates
- Quantity increment/decrement → total updates
- Empty cart shows empty state

### 3. Checkout Flow
- Navigate to checkout with cart items
- Delivery form validation (name, phone, address)
- Delivery fee calculation (free >300K, or ward-based)
- Payment method selection (COD, PayOS)

### 4. Payment Mock
- PayOS: mock redirect to payment gateway
- COD: mock order confirmation
- Failed payment: error state + retry

### 5. Order Success
- Order ID displayed
- Cart cleared
- Redirect available

### 6. KDS Status Updates
- Order appears in KDS board
- Status progression: pending → confirmed → preparing → ready
- Timer updates

## Mock Strategy

```typescript
// Mock Worker API responses
vi.mock('@/lib/api', () => ({
  fetchMenu: vi.fn().mockResolvedValue(MOCK_CATEGORIES),
  createOrder: vi.fn().mockResolvedValue(MOCK_ORDER),
  getOrders: vi.fn().mockResolvedValue([MOCK_ORDER]),
  updateOrderStatus: vi.fn().mockResolvedValue({}),
}));

// Use renderWithProviders for full context
renderWithProviders(<App />, { initialEntries: ['/menu'] });
```

## Expected Output

- 1 test file: `src/__tests__/order-flow-integration.test.tsx`
- 15-25 test cases
- All passing

## Files to Modify

| File | Action |
|------|--------|
| `src/__tests__/order-flow-integration.test.tsx` | Create |
| `src/test-utils.tsx` | May need to extend renderWithProviders |

## Success Criteria

- 15-25 integration tests passing
- All existing 2914+ tests still pass
- 0 TS errors
- Build <4s

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Tests too brittle with deep component tree | Medium | Medium | Mock at API boundary, not component level |
| Slow test execution | Low | Low | Mock heavy operations, keep test count reasonable |
| Missing test utilities | Medium | Low | Extend renderWithProviders as needed |

## Verification

```bash
npx vitest run src/__tests__/order-flow-integration.test.tsx  # New tests pass
npx vitest run                                                # Full suite still passes
```
