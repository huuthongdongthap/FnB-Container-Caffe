# Phase 6: Testing, Visual Regression & Deploy Gates

**Duration:** Week 6  
**Owner:** QA + DevOps Team  
**Dependencies:** Phases 1-5 complete

---

## 6.1 Test Strategy Overview

| Layer | Tool | Coverage Target | Scope |
|-------|------|-----------------|-------|
| **Unit** | Vitest | 80%+ | Hooks, utils, stores, pure components |
| **Integration** | Vitest + MSW | 100% API routes | All worker routes, DB operations |
| **E2E** | Playwright | 10 critical flows | Full user journeys |
| **Visual** | Playwright + pixelmatch | All Stitch pages + admin | Pixel-perfect vs design |
| **Accessibility** | axe-core + Playwright | WCAG 2.1 AA | All interactive pages |
| **Performance** | Lighthouse CI | Perf ≥ 90, A11y ≥ 95 | Production build |

---

## 6.2 Unit Tests (Vitest)

### Test Structure
```
src/
├── components/aura/**/*.test.tsx          # Primitive components
├── hooks/**/*.test.ts                     # Custom hooks
├── hooks/stores/**/*.test.ts              # Zustand stores
├── lib/**/*.test.ts                       # Utilities
├── utils/**/*.test.ts                     # Helpers
└── components/stitch/__tests__/           # Existing Stitch tests (migrate)
```

### Key Test Files
```typescript
// src/components/aura/primitives/Button/Button.test.tsx
import { render, screen, fireEvent } from '@/test-utils';
import { Button } from '@/components/aura';

describe('Button', () => {
  it('renders primary variant with chrome gradient', () => {
    render(<Button variant="primary">Click me</Button>);
    const btn = screen.getByRole('button', { name: 'Click me' });
    expect(btn).toHaveClass('bg-gradient-to-r'); // chrome gradient
    expect(btn).toHaveClass('text-primary-container');
  });

  it('shows loading spinner when loading', () => {
    render(<Button variant="bronze" loading>Order Now</Button>);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies active:scale-95 on press', () => {
    render(<Button variant="secondary">Press me</Button>);
    const btn = screen.getByRole('button');
    fireEvent.mouseDown(btn);
    expect(btn).toHaveClass('active:scale-[0.98]');
  });

  it('forwards ref for focus management', () => {
    const ref = vi.fn();
    render(<Button ref={ref}>Focusable</Button>);
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement));
  });
});
```

```typescript
// src/hooks/use-kds.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { useKDS } from '@/hooks/use-kds';
import { WebSocket } from 'ws'; // Mock

vi.mock('ws', () => ({
  WebSocket: vi.fn().mockImplementation(() => ({
    readyState: WebSocket.OPEN,
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
}));

describe('useKDS', () => {
  it('connects and authenticates', async () => {
    const { result } = renderHook(() => useKDS({ token: 'test-token' }));
    
    await waitFor(() => expect(result.current.connected).toBe(true));
    expect(WebSocket).toHaveBeenCalledWith(expect.stringContaining('token=test-token'));
  });

  it('claimOrder sends correct message', async () => {
    const { result } = renderHook(() => useKDS({ token: 'test-token' }));
    await waitFor(() => expect(result.current.connected).toBe(true));
    
    act(() => result.current.claimOrder('ORD-123'));
    
    expect(WebSocket.prototype.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'claim', orderId: 'ORD-123' })
    );
  });

  it('handles reconnection on close', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useKDS({ token: 'test-token' }));
    await waitFor(() => expect(result.current.connected).toBe(true));
    
    act(() => {
      // Simulate close
      const ws = (WebSocket as any).mock.results[0].value;
      ws.onclose?.(new CloseEvent('close'));
    });
    
    await waitFor(() => expect(result.current.connected).toBe(false));
    act(() => vi.advanceTimersByTime(1000));
    await waitFor(() => expect(result.current.connected).toBe(true));
    
    vi.useRealTimers();
  });
});
```

---

## 6.3 Integration Tests (Vitest + MSW)

```typescript
// worker/src/__tests__/routes/orders.integration.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { ordersRoutes } from '@/routes/orders-hono';
import { setupMSW } from '../utils/msw-setup';

const app = new Hono().route('/api', ordersRoutes);

describe('Orders API', () => {
  beforeEach(() => {
    setupMSW();
    vi.clearAllMocks();
  });

  it('creates order with locale and location_id', async () => {
    const res = await app.request('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
      body: JSON.stringify({
        tableId: 'table-1',
        items: [{ productId: 'midnight-espresso', quantity: 2 }],
        serviceType: 'dine_in',
      }),
    });
    
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.order.locale).toBe('vi-VN');
    expect(data.order.location_id).toBe('sa-dec-main');
  });

  it('validates PayOS webhook idempotency', async () => {
    const payload = { orderId: 'ORD-123', amount: 100000 };
    const idempotencyKey = 'webhook-123';
    
    // First request
    const res1 = await app.request('/api/webhooks/payos', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-webhook-idempotency-key': idempotencyKey 
      },
      body: JSON.stringify(payload),
    });
    expect(res1.status).toBe(200);
    
    // Duplicate request
    const res2 = await app.request('/api/webhooks/payos', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-webhook-idempotency-key': idempotencyKey 
      },
      body: JSON.stringify(payload),
    });
    expect(res2.status).toBe(409); // Conflict - already processed
  });
});
```

---

## 6.4 E2E Tests (Playwright) — 10 Critical Flows

```typescript
// tests/e2e/critical-flows.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Critical User Flows', () => {
  
  test('Flow 1: Happy Path - Landing → Menu → Cart → Checkout (PayOS) → Success → Loyalty', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('AURA CAFE');
    
    await page.click('a[href="/menu"]');
    await expect(page.locator('[data-testid="category-tabs"]')).toBeVisible();
    
    // Add item to cart
    await page.click('[data-testid="item-midnight-espresso"] button:has-text("Thêm")');
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('1');
    
    // Open cart and checkout
    await page.click('[data-testid="cart-button"]');
    await page.click('button:has-text("Thanh toán")');
    
    // Fill info
    await page.fill('[name="customerName"]', 'Nguyễn Văn Test');
    await page.fill('[name="phone"]', '0901234567');
    await page.click('button:has-text("Tiếp theo")');
    
    // Payment - mock PayOS
    await page.click('[data-testid="payment-payos"]');
    await page.click('button:has-text("Đặt hàng")');
    
    // Mock PayOS redirect return
    await page.waitForURL('/order/success/*');
    await expect(page.locator('h1')).toContainText('Đặt Hàng Thành Công');
    
    // Loyalty enroll prompt
    await expect(page.locator('[data-testid="loyalty-enroll"]')).toBeVisible();
  });

  test('Flow 2: Failure Recovery - Payment Fail → Retry with COD → Success', async ({ page }) => {
    await page.goto('/checkout?session=failed-session');
    
    await expect(page.locator('h1')).toContainText('Payment Failed');
    await page.click('button:has-text("Thử lại với COD")');
    
    await page.fill('[name="customerName"]', 'Test COD');
    await page.fill('[name="phone"]', '0901234567');
    await page.click('button:has-text("Xác nhận COD")');
    
    await page.waitForURL('/order/success/*');
    await expect(page.locator('[data-testid="payment-method"]')).toContainText('COD');
  });

  test('Flow 3: Admin Order Flow - New Order → KDS Notify → Staff Claim → Prepare → Ready → Serve', async ({ page }) => {
    // Login as staff
    await page.goto('/admin');
    await page.fill('[name="email"]', 'staff@auracafe.vn');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Wait for real-time order
    await page.waitForSelector('[data-testid="order-ORD-999"]', { state: 'visible' });
    
    // Claim order
    await page.click('[data-testid="order-ORD-999"] button:has-text("Nhận đơn")');
    await expect(page.locator('[data-testid="order-ORD-999"]')).toHaveAttribute('data-status', 'preparing');
    
    // Prepare items
    await page.click('[data-testid="order-ORD-999"] button:has-text("Làm xong")');
    await expect(page.locator('[data-testid="order-ORD-999"]')).toHaveAttribute('data-status', 'ready');
    
    // Serve
    await page.click('[data-testid="order-ORD-999"] button:has-text("Phục vụ")');
    await expect(page.locator('[data-testid="order-ORD-999"]')).toHaveAttribute('data-status', 'served');
  });

  test('Flow 4: Reservation - Pick Zone/Time → Confirm → Check-in → Table Service', async ({ page }) => {
    await page.goto('/reserve');
    await page.click('[data-testid="zone-rooftop"]');
    await page.click('[data-testid="time-19-00"]');
    await page.fill('[name="partySize"]', '4');
    await page.fill('[name="customerName"]', 'Test Group');
    await page.fill('[name="phone"]', '0901234567');
    await page.click('button:has-text("Đặt chỗ")');
    
    await expect(page.locator('[data-testid="reservation-confirmed"]')).toBeVisible();
    
    // Admin check-in
    await page.goto('/admin/orders');
    await page.click('[data-testid="reservation-checkin"]');
    await expect(page.locator('[data-testid="table-status"]')).toContainText('Đang phục vụ');
  });

  test('Flow 5: Offline - Load Menu Offline → Add to Cart → Reconnect → Sync Order', async ({ page }) => {
    await page.goto('/menu');
    await expect(page.locator('[data-testid="category-tabs"]')).toBeVisible();
    
    // Go offline
    await page.context().setOffline(true);
    await page.reload();
    
    // Menu should still load from cache
    await expect(page.locator('[data-testid="category-tabs"]')).toBeVisible();
    await page.click('[data-testid="item-midnight-espresso"] button:has-text("Thêm")');
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('1');
    
    // Go online and sync
    await page.context().setOffline(false);
    await page.click('[data-testid="cart-button"]');
    await page.click('button:has-text("Thanh toán")');
    
    await page.waitForURL('/order/success/*');
  });

  test('Flow 6: Mobile QR Ordering - Scan → Menu → Cart → Checkout → Track', async ({ page }) => {
    await page.goto('/m/table-05');
    await expect(page.locator('[data-testid="table-badge"]')).toContainText('Bàn 05');
    
    await page.click('[data-testid="item-chrome-velvet-latte"] button:has-text("Thêm")');
    await page.click('[data-testid="floating-cart"]');
    await page.click('button:has-text("Thanh toán")');
    
    await page.fill('[name="customerName"]', 'Mobile User');
    await page.click('[data-testid="payment-cod"]');
    await page.click('button:has-text("Đặt hàng")');
    
    await page.waitForURL('/m/table-05/track');
    await expect(page.locator('[data-testid="order-status"]')).toContainText('Chờ xác nhận');
  });

  test('Flow 7: Loyalty - Earn Points → Tier Upgrade → Redeem Reward', async ({ page }) => {
    await page.goto('/loyalty');
    await expect(page.locator('[data-testid="tier-card"]')).toContainText('Bronze');
    
    // Simulate earning points via order
    await page.goto('/menu');
    await page.click('[data-testid="item-midnight-espresso"] button:has-text("Thêm")');
    await page.click('[data-testid="cart-button"]');
    await page.click('button:has-text("Thanh toán")');
    // ... complete order
    
    await page.goto('/loyalty');
    await expect(page.locator('[data-testid="tier-card"]')).toContainText('Silver');
    await page.click('[data-testid="reward-free-coffee"] button:has-text("Đổi thưởng")');
    await expect(page.locator('[data-testid="reward-redeemed"]')).toBeVisible();
  });

  test('Flow 8: Staff Shift - Clock In → View Orders → Clock Out', async ({ page }) => {
    await page.goto('/admin/staff');
    await page.click('button:has-text("Check-in ca làm")');
    await expect(page.locator('[data-testid="shift-status"]')).toContainText('Đang làm');
    
    await page.goto('/admin/orders');
    await expect(page.locator('[data-testid="my-orders"]')).toBeVisible();
    
    await page.goto('/admin/staff');
    await page.click('button:has-text("Check-out")');
    await expect(page.locator('[data-testid="shift-status"]')).toContainText('Đã kết thúc');
  });

  test('Flow 9: Inventory - Low Stock Alert → Purchase Order → Receive Stock', async ({ page }) => {
    await page.goto('/admin/inventory');
    await expect(page.locator('[data-testid="low-stock-alert"]')).toBeVisible();
    
    await page.click('[data-testid="low-stock-alert"] button:has-text("Tạo PO")');
    await page.fill('[name="quantity"]', '50');
    await page.click('button:has-text("Gửi nhà cung cấp")');
    
    // Simulate receiving
    await page.click('[data-testid="po-receive"]');
    await page.fill('[name="receivedQty"]', '50');
    await page.click('button:has-text("Xác nhận nhận hàng")');
    
    await expect(page.locator('[data-testid="low-stock-alert"]')).not.toBeVisible();
  });

  test('Flow 10: Promotions - Create Campaign → Broadcast → Track Redemption', async ({ page }) => {
    await page.goto('/admin/promotions');
    await page.click('button:has-text("Tạo chiến dịch")');
    await page.fill('[name="name"]', 'Happy Hour 20%');
    await page.fill('[name="discount"]', '20');
    await page.selectOption('[name="appliesTo"]', 'drinks');
    await page.click('button:has-text("Phát sóng")');
    
    await page.goto('/promotions');
    await expect(page.locator('[data-testid="promo-happy-hour"]')).toBeVisible();
    await page.click('[data-testid="promo-happy-hour"] button:has-text("Sao chép mã")');
    
    // Verify redemption tracking
    await page.goto('/admin/promotions');
    await expect(page.locator('[data-testid="redemption-count"]')).toContainText('1');
  });
});
```

---

## 6.5 Visual Regression Tests

### Configuration
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report' }]],
  
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 12'] } },
  ],
  
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  
  // Visual regression
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100, // 0.1% threshold
      threshold: 0.1,
      animations: 'disabled',
    },
  },
});
```

### Visual Test Specs
```typescript
// tests/visual/stitch-pages.spec.ts
import { test, expect } from '@playwright/test';

const STITCH_PAGES = [
  { path: '/', name: 'landing' },
  { path: '/menu', name: 'digital-menu' },
  { path: '/about', name: 'about' },
  { path: '/checkout', name: 'checkout-step-1' },
  { path: '/order/success/TEST-123', name: 'order-success' },
  { path: '/order/failure/TEST-123', name: 'order-failure' },
  { path: '/loyalty', name: 'loyalty' },
  { path: '/reserve', name: 'reservation' },
  { path: '/admin', name: 'admin-dashboard' },
  { path: '/admin/orders', name: 'admin-orders' },
  { path: '/admin/menu', name: 'admin-menu' },
  { path: '/m/table-01', name: 'mobile-menu' },
];

for (const page of STITCH_PAGES) {
  test(`Visual: ${page.name}`, async ({ page }) => {
    await page.goto(page.path);
    await page.waitForLoadState('networkidle');
    
    // Wait for scroll animations
    await page.waitForTimeout(1000);
    
    // Full page screenshot
    await expect(page).toHaveScreenshot(`${page.name}-full.png`, {
      fullPage: true,
      animations: 'disabled',
    });
    
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot(`${page.name}-mobile.png`, {
      fullPage: true,
      animations: 'disabled',
    });
  });
}
```

### Baseline Management
```bash
# Generate baselines
npx playwright test --update-snapshots

# CI compares against committed baselines in tests/visual/__snapshots__/
# PRs with visual changes require baseline approval
```

---

## 6.6 Accessibility Tests

```typescript
// tests/a11y/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES_TO_TEST = [
  '/', '/menu', '/about', '/checkout', '/order/success/TEST',
  '/order/failure/TEST', '/loyalty', '/reserve', '/track/TEST',
  '/admin', '/admin/orders', '/m/table-01',
];

for (const path of PAGES_TO_TEST) {
  test(`A11y: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });
}

// Keyboard navigation test
test('Keyboard navigation: Tab order matches visual order', async ({ page }) => {
  await page.goto('/menu');
  
  // Tab through all focusable elements
  const focusableElements = await page.locator('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])').all();
  
  for (let i = 0; i < focusableElements.length; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement);
    expect(focused).toBe(focusableElements[i]);
  }
});
```

---

## 6.7 Performance Tests (Lighthouse CI)

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [push, pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run build
      - run: npx http-server dist -p 5173 &
      - uses: treosh/lighthouse-ci-action@v11
        with:
          urls: |
            http://localhost:5173/
            http://localhost:5173/menu
            http://localhost:5173/about
            http://localhost:5173/checkout
          budgetPath: ./lighthouse-budget.json
          uploadArtifacts: true
```

```json
// lighthouse-budget.json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.9 }],
        "categories:seo": ["warn", { "minScore": 0.8 }],
        "categories:pwa": ["warn", { "minScore": 0.9 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 1800 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }],
        "interactive": ["error", { "maxNumericValue": 3500 }]
      }
    }
  }
}
```

---

## 6.8 Deploy Pipeline Enhancement

```bash
#!/bin/bash
# scripts/deploy.sh - Enhanced with all gates

set -euo pipefail

echo "🚀 Starting AURA CAFE Deploy Pipeline"

# 1. TypeScript strict check
echo "📝 TypeScript check..."
cd worker && npm run typecheck && cd ..
cd frontend && npm run typecheck && cd ..

# 2. Stylelint DESIGN.md token enforcement
echo "🎨 Stylelint token enforcement..."
cd frontend && npm run lint:styles && cd ..

# 3. Vitest unit + integration
echo "🧪 Unit & Integration tests..."
cd worker && npm run test:unit && cd ..
cd frontend && npm run test:unit && cd ..

# 4. Playwright E2E on staging
echo "🎭 E2E tests on staging..."
cd frontend && npm run test:e2e:staging && cd ..

# 5. Visual regression
echo "👁️ Visual regression..."
cd frontend && npm run test:visual && cd ..

# 6. Lighthouse CI
echo "⚡ Lighthouse CI..."
cd frontend && npm run lighthouse && cd ..

# 7. Build production
echo "🏗️ Production build..."
cd worker && npm run build && cd ..
cd frontend && npm run build && cd ..

# 8. Deploy to Cloudflare
echo "☁️ Deploying to Cloudflare..."
cd worker && npx wrangler deploy --env production && cd ..
cd frontend && npx wrangler pages deploy dist --project-name=aura-cafe && cd ..

# 9. Smoke tests (12 endpoints)
echo "💨 Smoke tests..."
cd worker && npm run smoke:production && cd ..

# 10. Health check
echo "❤️ Health check..."
curl -f https://api.auracafe.vn/health || exit 1
curl -f https://auracafe.vn/ || exit 1

echo "✅ Deploy complete!"
```

### Smoke Test Script
```typescript
// worker/scripts/smoke-test.ts
const SMOKE_ENDPOINTS = [
  { method: 'GET', path: '/health', expect: 200 },
  { method: 'GET', path: '/api/menu/categories', expect: 200 },
  { method: 'GET', path: '/api/menu/items', expect: 200 },
  { method: 'POST', path: '/api/auth/login', body: { email: 'test@test.com', password: 'test' }, expect: 200 },
  { method: 'GET', path: '/api/orders', auth: true, expect: 200 },
  { method: 'POST', path: '/api/orders', auth: true, body: { tableId: 'test', items: [], serviceType: 'dine_in' }, expect: 201 },
  { method: 'GET', path: '/api/loyalty/tiers', expect: 200 },
  { method: 'GET', path: '/api/zones', expect: 200 },
  { method: 'GET', path: '/api/kds/orders', auth: true, expect: 200 },
  { method: 'GET', path: '/api/admin/stats', auth: true, roles: ['owner'], expect: 200 },
  { method: 'POST', path: '/api/webhooks/payos', body: { test: true }, expect: 400 }, // Invalid but endpoint exists
  { method: 'GET', path: '/api/openapi.json', expect: 200 },
];

async function runSmokeTests(baseUrl: string, token: string) {
  for (const endpoint of SMOKE_ENDPOINTS) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (endpoint.auth) headers['Authorization'] = `Bearer ${token}`;
    
    const res = await fetch(`${baseUrl}${endpoint.path}`, {
      method: endpoint.method,
      headers,
      body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
    });
    
    if (res.status !== endpoint.expect) {
      throw new Error(`Smoke test failed: ${endpoint.method} ${endpoint.path} → ${res.status} (expected ${endpoint.expect})`);
    }
    console.log(`✅ ${endpoint.method} ${endpoint.path} → ${res.status}`);
  }
}
```

---

## 6.9 Rollback Procedure

```bash
#!/bin/bash
# scripts/rollback.sh

set -euo pipefail

PREVIOUS_WORKER_DEPLOYMENT=$1  # Get from wrangler deployments list
PREVIOUS_PAGES_DEPLOYMENT=$2   # Get from Cloudflare Pages dashboard

echo "🔄 Rolling back to:"
echo "  Worker: $PREVIOUS_WORKER_DEPLOYMENT"
echo "  Pages: $PREVIOUS_PAGES_DEPLOYMENT"

# Rollback Worker
cd worker
npx wrangler rollback $PREVIOUS_WORKER_DEPLOYMENT --env production
cd ..

# Rollback Pages
cd frontend
npx wrangler pages deployment rollback $PREVIOUS_PAGES_DEPLOYMENT --project-name=aura-cafe
cd ..

# Verify
sleep 10
curl -f https://api.auracafe.vn/health || exit 1
curl -f https://auracafe.vn/ || exit 1

echo "✅ Rollback complete"
```

---

## 6.10 Acceptance Criteria

### Test Coverage
- [ ] Unit tests: 80%+ coverage on hooks, utils, stores, primitives
- [ ] Integration tests: 100% API routes covered
- [ ] E2E tests: 10 critical flows pass on staging
- [ ] Visual regression: 0 pixel diff vs baselines for all 12 Stitch pages
- [ ] Accessibility: 0 axe-core violations (WCAG 2.1 AA)
- [ ] Performance: Lighthouse Perf ≥ 90, A11y ≥ 95, CLS < 0.1

### Deploy Gates
- [ ] All gates pass in CI before merge to main
- [ ] Deploy script runs all gates sequentially
- [ ] Rollback tested and documented
- [ ] Smoke tests verify production health post-deploy
- [ ] Deploy time < 10 minutes (including tests)

### Quality Metrics
- [ ] Bundle size: < 200KB gzipped (initial JS)
- [ ] TTI: < 3.5s on 3G
- [ ] LCP: < 2.5s
- [ ] CLS: < 0.1
- [ ] Zero console errors in production

---

## File Ownership Matrix

| Area | Files | Owner |
|------|-------|-------|
| Unit Tests | `src/**/*.test.tsx`, `worker/src/__tests__/**` | Feature Teams |
| E2E Tests | `tests/e2e/*.spec.ts` | QA Team |
| Visual Tests | `tests/visual/*.spec.ts`, baselines | QA + Design |
| A11y Tests | `tests/a11y/*.spec.ts` | QA Team |
| Performance | `lighthouse-budget.json`, CI config | DevOps |
| Deploy Scripts | `scripts/deploy.sh`, `scripts/rollback.sh` | DevOps |
| Smoke Tests | `worker/scripts/smoke-test.ts` | Backend |

---

## Rollback Plan
- All gates can be skipped via env var in emergency (`SKIP_VISUAL=1`, `SKIP_E2E=1`)
- But never skip: TypeScript, Stylelint, Unit tests, Smoke tests
- Rollback script tested monthly in drill

---

## Timeline Summary

| Week | Phase | Key Deliverable |
|------|-------|-----------------|
| 1 | Phase 1 | OpenAPI spec, DB locality, Device trust, Payment resilience |
| 2-3 | Phase 2 | Aura component library (30+ primitives), Storybook, Stylelint |
| 3-4 | Phase 3 | 12 public pages, 12 admin pages, 4 mobile pages |
| 4-5 | Phase 4 | KDS WebSocket, Offline queue, PWA, Admin realtime |
| 5 | Phase 5 | Full vi/en content, Local imagery, Diacritic slugs |
| 6 | Phase 6 | Test suite, Visual regression, Deploy pipeline |

**Total: 6 weeks to production-ready, locally-grounded container cafe platform**