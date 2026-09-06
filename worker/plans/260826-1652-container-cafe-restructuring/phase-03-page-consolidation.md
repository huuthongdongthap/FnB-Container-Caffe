# Phase 3: Page Consolidation & Route Restructuring

**Duration:** Week 3-4  
**Owner:** Feature Teams (Public, Admin, Mobile)  
**Dependencies:** Phase 2 (Aura primitives + shells stable)

---

## 3.1 Public Routes (Customer-Facing) — 12 Pages

### Route Map
| Route | Component | Shell | Stitch Source | Key Features |
|-------|-----------|-------|---------------|--------------|
| `/` | `LandingPage` | `LandingShell` | `luxury-landing-hero` + `luxury-cafe-1` | Hero, features, story preview, CTA |
| `/menu` | `DigitalMenuPage` | `MenuShell` | `digital-menu` (v2) | Category tabs, search, item grid, cart sidebar |
| `/about` | `AboutPage` | `PageShell` | `our-story` + `StitchAbout` | Hero, story bento, timeline, values, zones, CTA |
| `/checkout` | `CheckoutPage` | `PageShell` | `premium-checkout` | Multi-step: info → payment → confirm |
| `/order/success/:id` | `OrderSuccessPage` | `PageShell` | `order-success` | Receipt, loyalty enroll, social share |
| `/order/failure/:id` | `OrderFailurePage` | `PageShell` | `order-failure` | Retry, alternative methods, support |
| `/loyalty` | `LoyaltyPage` | `PageShell` | `loyalty-rewards` | Tier card, points history, referrals |
| `/reserve` | `ReservationPage` | `PageShell` | Adapted from `referral-rewards-1` | Zone picker, time slots, party size |
| `/track/:code` | `TrackOrderPage` | `PageShell` | New (KDS WebSocket) | Real-time status, ETA, map |
| `/events` | `EventsPage` | `PageShell` | `events-promotions-1` | Event cards, RSVP, calendar |
| `/promotions` | `PromotionsPage` | `PageShell` | `promotions` | Promo cards, code copy, terms |
| `/contact` | `ContactPage` | `PageShell` | `contact-new` | Form, map, hours, FAQ accordion |

### Implementation Details

#### LandingPage (`/`)
```tsx
// src/pages/stitch/landing-page/index.tsx
import { LandingShell, HeroSection, FeatureSection, CTASection } from '@/components/aura';

export default function LandingPage() {
  return (
    <LandingShell>
      <HeroSection 
        titleKey="landing.hero.title"
        subtitleKey="landing.hero.subtitle"
        ctaTextKey="landing.hero.cta"
        ctaHref="/menu"
        background="hero-container-sa-dec.jpg"
      />
      <FeatureSection features={[
        { icon: 'coffee', titleKey: 'landing.features.coffee', descKey: 'landing.features.coffee_desc' },
        { icon: 'container', titleKey: 'landing.features.container', descKey: 'landing.features.container_desc' },
        { icon: 'local', titleKey: 'landing.features.local', descKey: 'landing.features.local_desc' },
        { icon: 'tech', titleKey: 'landing.features.tech', descKey: 'landing.features.tech_desc' },
      ]} />
      <CTASection 
        titleKey="landing.cta.title"
        descKey="landing.cta.desc"
        primaryCta={{ textKey: 'landing.cta.primary', href: '/menu' }}
        secondaryCta={{ textKey: 'landing.cta.secondary', href: '/about' }}
      />
    </LandingShell>
  );
}
```

#### DigitalMenuPage (`/menu`)
```tsx
// src/pages/stitch/digital-menu-page/index.tsx
import { MenuShell, CategoryTabs, ItemGrid, CartSidebar } from '@/components/aura';
import { useMenuStore } from '@/hooks/stores/use-menu-store';
import { useCartStore } from '@/hooks/stores/use-cart-store';

export default function DigitalMenuPage() {
  const { categories, items, activeCategory, setActiveCategory } = useMenuStore();
  const { cart, addItem, removeItem } = useCartStore();

  return (
    <MenuShell>
      <CategoryTabs 
        categories={categories} 
        active={activeCategory} 
        onChange={setActiveCategory} 
      />
      <ItemGrid 
        items={items.filter(i => i.category_id === activeCategory)} 
        onAdd={addItem}
      />
      <CartSidebar 
        items={cart} 
        onUpdate={updateQuantity}
        onCheckout={() => navigate('/checkout')}
      />
    </MenuShell>
  );
}
```

#### AboutPage (`/about`) — Already exists as `StitchAbout`, wrap in `PageShell`
```tsx
// src/pages/stitch/about-page/index.tsx
import { PageShell } from '@/components/aura';
import { StitchAbout } from '@/components/stitch';

export default function AboutPage() {
  return (
    <PageShell>
      <StitchAbout />
    </PageShell>
  );
}
```

#### CheckoutPage (`/checkout`) — Multi-step with `CheckoutFlow` pattern
```tsx
// src/pages/stitch/checkout-page/index.tsx
import { PageShell } from '@/components/aura';
import { CheckoutFlow } from '@/components/aura/patterns';

export default function CheckoutPage() {
  return (
    <PageShell>
      <CheckoutFlow 
        steps={[
          { id: 'info', component: <CheckoutStepInfo /> },
          { id: 'payment', component: <CheckoutStepPayment /> },
          { id: 'confirm', component: <CheckoutStepConfirm /> },
        ]}
        onComplete={(orderId) => navigate(`/order/success/${orderId}`)}
        onFailure={(orderId) => navigate(`/order/failure/${orderId}`)}
      />
    </PageShell>
  );
}
```

---

## 3.2 Admin Routes — 12 Pages (from 142)

### Consolidation Map
| New Route | Consolidates | Component | Shell |
|-----------|--------------|-----------|-------|
| `/admin` | Dashboard, Metrics, QuickActions | `AdminDashboard` | `AdminShell` |
| `/admin/orders` | TableOrder*, OrderList*, POS*, OrderManagement* | `OrderManagementTerminal` | `AdminShell` |
| `/admin/menu` | ProductList, CategoryList, Variants, Modifiers | `MenuManagement` | `AdminShell` |
| `/admin/staff` | Users, Shifts, Tips, Performance, Birthdays | `StaffManagement` | `AdminShell` |
| `/admin/inventory` | Stock, Suppliers, WasteLog, PurchaseOrders | `InventoryControl` | `AdminShell` |
| `/admin/finance` | Sales, Payouts, Tax, PayOS Reconciliation | `FinancialTerminal` | `AdminShell` |
| `/admin/loyalty` | Tiers, Campaigns, Referrals, PointsConfig | `LoyaltyAdmin` | `AdminShell` |
| `/admin/settings` | General, Integrations, Webhooks, Branding | `SettingsPanel` | `AdminShell` |
| `/admin/audit` | AuditLogViewer (keep) | `AuditLogViewer` | `AdminShell` |
| `/admin/kds` | KitchenDisplaySystem (keep) | `KitchenDisplaySystem` | `AdminShell` |
| `/admin/analytics` | Analytics, Reports, Exports | `AnalyticsDashboard` | `AdminShell` |
| `/admin/promotions` | Broadcast, Campaigns, Coupons | `PromotionsAdmin` | `AdminShell` |

### AdminDashboard (`/admin`)
```tsx
// src/pages/admin/dashboard/index.tsx
import { AdminShell } from '@/components/aura';
import { DataTable, Card, StatCard } from '@/components/aura';
import { useAdminStore } from '@/hooks/stores/use-admin-store';

export default function AdminDashboard() {
  const { stats, recentOrders, lowStock, todayRevenue } = useAdminStore();

  return (
    <AdminShell>
      <AdminShell.Header title="Dashboard" subtitle="Tổng quan quán" />
      <AdminShell.Content>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Đơn hôm nay" value={stats.ordersToday} trend={stats.ordersTrend} icon="receipt_long" />
          <StatCard label="Doanh thu" value={formatCurrency(todayRevenue)} trend={stats.revenueTrend} icon="attach_money" />
          <StatCard label="Đang phục vụ" value={stats.activeOrders} icon="restaurant" variant="warning" />
          <StatCard label="Kho thấp" value={lowStock.count} trend={lowStock.trend} icon="inventory_2" variant="danger" />
        </div>
        <div className="grid gap-4 mt-6 lg:grid-cols-2">
          <Card variant="elevated" padding="md">
            <CardHeader title="Đơn gần đây" action={{ label: "Xem tất cả", href: "/admin/orders" }} />
            <DataTable 
              columns={orderColumns} 
              data={recentOrders} 
              pagination={false}
              rowAction={(o) => navigate(`/admin/orders/${o.id}`)}
            />
          </Card>
          <Card variant="elevated" padding="md">
            <CardHeader title="Cần chú ý" />
            <AlertList alerts={[
              ...lowStock.items.map(i => ({ type: 'warning', message: `${i.name} còn ${i.qty}`, href: `/admin/inventory/${i.id}` })),
              ...stats.pendingRefunds.map(r => ({ type: 'info', message: `Hoàn tiền ${r.id}`, href: `/admin/finance/refunds/${r.id}` })),
            ]} />
          </Card>
        </div>
      </AdminShell.Content>
    </AdminShell>
  );
}
```

### OrderManagementTerminal (`/admin/orders`) — Already exists, enhance
```tsx
// src/pages/stitch/admin-orders/index.tsx (enhance existing)
import { AdminShell } from '@/components/aura';
import { DataTable, Tabs, Chip, Button, Modal } from '@/components/aura';
import { useOrderManagementStore } from '@/hooks/stores/use-order-management-store';

export default function OrderManagementTerminal() {
  const { orders, filters, setFilters, actions } = useOrderManagementStore();

  return (
    <AdminShell>
      <AdminShell.Header 
        title="Quản lý đơn" 
        subtitle="Theo dõi & xử lý đơn hàng"
        actions={<Button variant="primary" onClick={actions.createOrder}>Tạo đơn mới</Button>}
      />
      <AdminShell.Content>
        <Tabs 
          tabs={[
            { id: 'all', label: 'Tất cả' },
            { id: 'pending', label: 'Chờ xác nhận', count: filters.counts.pending },
            { id: 'preparing', label: 'Đang làm', count: filters.counts.preparing },
            { id: 'ready', label: 'Sẵn sàng', count: filters.counts.ready },
            { id: 'served', label: 'Đã phục vụ', count: filters.counts.served },
          ]}
          active={filters.status}
          onChange={setFilters.status}
        />
        <DataTable
          columns={orderColumns}
          data={orders}
          pagination={{ pageSize: 20 }}
          sorting
          filtering
          rowActions={[
            { label: 'Xem', onClick: (o) => navigate(`/admin/orders/${o.id}`) },
            { label: 'In', onClick: actions.print },
            { label: 'Hủy', variant: 'danger', onClick: actions.cancel, show: (o) => o.status === 'pending' },
          ]}
          bulkActions={[
            { label: 'In hàng loạt', onClick: actions.bulkPrint },
            { label: 'Xuất Excel', onClick: actions.export },
          ]}
        />
      </AdminShell.Content>
    </AdminShell>
  );
}
```

---

## 3.3 Mobile Routes (QR Ordering) — 4 Pages

### Route Map
| Route | Component | Shell | Features |
|-------|-----------|-------|----------|
| `/m/:tableId` | `MobileMenuPage` | `MobileShell` | Category tabs, item cards, floating cart button |
| `/m/:tableId/cart` | `MobileCartSheet` | Sheet (overlay) | Slide-up cart, quantity adjust, voucher input |
| `/m/:tableId/checkout` | `MobileCheckoutPage` | `MobileShell` | Simplified: contact → payment (PayOS/COD) → confirm |
| `/m/:tableId/track` | `MobileTrackPage` | `MobileShell` | WebSocket status, ETA, call waiter button |

### MobileMenuPage
```tsx
// src/pages/stitch/mobile-menu-page/index.tsx
import { MobileShell } from '@/components/aura';
import { CategoryTabs, ItemGrid, FloatingCartButton } from '@/components/aura';

export default function MobileMenuPage({ params }: { params: { tableId: string } }) {
  const { tableId } = params;
  const { categories, items, activeCategory, setActiveCategory } = useMenuStore(tableId);
  const { cartCount, cartTotal } = useCartStore(tableId);

  return (
    <MobileShell tableId={tableId}>
      <CategoryTabs categories={categories} active={activeCategory} onChange={setActiveCategory} />
      <ItemGrid items={items.filter(i => i.category_id === activeCategory)} compact />
      <FloatingCartButton count={cartCount} total={cartTotal} onClick={() => openCartSheet()} />
    </MobileShell>
  );
}
```

---

## 3.4 Route Configuration Updates

### stitch-routes.tsx (Public)
```tsx
// src/routes/stitch-routes.tsx
import React from 'react';
import { Route } from 'react-router-dom';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

const guarded = (element: React.ReactNode) => <ErrorBoundary>{element}</ErrorBoundary>;

// Public pages
const LandingPage = React.lazy(() => import('@/pages/stitch/landing-page'));
const DigitalMenuPage = React.lazy(() => import('@/pages/stitch/digital-menu-page'));
const AboutPage = React.lazy(() => import('@/pages/stitch/about-page'));
const CheckoutPage = React.lazy(() => import('@/pages/stitch/checkout-page'));
const OrderSuccessPage = React.lazy(() => import('@/pages/stitch/order-success-page'));
const OrderFailurePage = React.lazy(() => import('@/pages/stitch/order-failure-page'));
const LoyaltyPage = React.lazy(() => import('@/pages/stitch/loyalty-page'));
const ReservationPage = React.lazy(() => import('@/pages/stitch/reservation-page'));
const TrackOrderPage = React.lazy(() => import('@/pages/stitch/track-order-page'));
const EventsPage = React.lazy(() => import('@/pages/stitch/events-page'));
const PromotionsPage = React.lazy(() => import('@/pages/stitch/promotions-page'));
const ContactPage = React.lazy(() => import('@/pages/stitch/contact-page'));

export const stitchRoutes = {
  _tag: 'stitch-routes',
  children: [
    <Route key="landing" path="/" element={guarded(<LandingPage />)} />,
    <Route key="menu" path="/menu" element={guarded(<DigitalMenuPage />)} />,
    <Route key="about" path="/about" element={guarded(<AboutPage />)} />,
    <Route key="checkout" path="/checkout" element={guarded(<CheckoutPage />)} />,
    <Route key="order-success" path="/order/success/:id" element={guarded(<OrderSuccessPage />)} />,
    <Route key="order-failure" path="/order/failure/:id" element={guarded(<OrderFailurePage />)} />,
    <Route key="loyalty" path="/loyalty" element={guarded(<LoyaltyPage />)} />,
    <Route key="reserve" path="/reserve" element={guarded(<ReservationPage />)} />,
    <Route key="track" path="/track/:code" element={guarded(<TrackOrderPage />)} />,
    <Route key="events" path="/events" element={guarded(<EventsPage />)} />,
    <Route key="promotions" path="/promotions" element={guarded(<PromotionsPage />)} />,
    <Route key="contact" path="/contact" element={guarded(<ContactPage />)} />,
  ],
};
```

### admin-routes.tsx (Admin)
```tsx
// src/routes/admin-routes.tsx
import React from 'react';
import { Route } from 'react-router-dom';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { AuthGuard } from '@/components/auth/AuthGuard';

const guarded = (element: React.ReactNode) => (
  <ErrorBoundary>
    <AuthGuard roles={['owner', 'manager', 'staff']}>{element}</AuthGuard>
  </ErrorBoundary>
);

const AdminDashboard = React.lazy(() => import('@/pages/admin/dashboard'));
const OrderManagementTerminal = React.lazy(() => import('@/pages/stitch/admin-orders'));
const MenuManagement = React.lazy(() => import('@/pages/admin/menu-management'));
const StaffManagement = React.lazy(() => import('@/pages/admin/staff-management'));
const InventoryControl = React.lazy(() => import('@/pages/admin/inventory-control'));
const FinancialTerminal = React.lazy(() => import('@/pages/admin/financial-terminal'));
const LoyaltyAdmin = React.lazy(() => import('@/pages/admin/loyalty-admin'));
const SettingsPanel = React.lazy(() => import('@/pages/admin/settings-panel'));
const AuditLogViewer = React.lazy(() => import('@/pages/admin/AuditLogViewer'));
const KitchenDisplaySystem = React.lazy(() => import('@/pages/stitch/kitchen-display'));
const AnalyticsDashboard = React.lazy(() => import('@/pages/admin/analytics-dashboard'));
const PromotionsAdmin = React.lazy(() => import('@/pages/admin/promotions-admin'));

export const adminRoutes = {
  _tag: 'admin-routes',
  children: [
    <Route key="admin-root" path="/admin" element={guarded(<AdminDashboard />)} />,
    <Route key="admin-orders" path="/admin/orders" element={guarded(<OrderManagementTerminal />)} />,
    <Route key="admin-menu" path="/admin/menu" element={guarded(<MenuManagement />)} />,
    <Route key="admin-staff" path="/admin/staff" element={guarded(<StaffManagement />)} />,
    <Route key="admin-inventory" path="/admin/inventory" element={guarded(<InventoryControl />)} />,
    <Route key="admin-finance" path="/admin/finance" element={guarded(<FinancialTerminal />)} />,
    <Route key="admin-loyalty" path="/admin/loyalty" element={guarded(<LoyaltyAdmin />)} />,
    <Route key="admin-settings" path="/admin/settings" element={guarded(<SettingsPanel />)} />,
    <Route key="admin-audit" path="/admin/audit" element={guarded(<AuditLogViewer />)} />,
    <Route key="admin-kds" path="/admin/kds" element={guarded(<KitchenDisplaySystem />)} />,
    <Route key="admin-analytics" path="/admin/analytics" element={guarded(<AnalyticsDashboard />)} />,
    <Route key="admin-promotions" path="/admin/promotions" element={guarded(<PromotionsAdmin />)} />,
  ],
};
```

### mobile-routes.tsx (QR Ordering)
```tsx
// src/routes/mobile-routes.tsx
import React from 'react';
import { Route } from 'react-router-dom';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

const guarded = (element: React.ReactNode) => <ErrorBoundary>{element}</ErrorBoundary>;

const MobileMenuPage = React.lazy(() => import('@/pages/stitch/mobile-menu-page'));
const MobileCartSheet = React.lazy(() => import('@/pages/stitch/mobile-cart-sheet'));
const MobileCheckoutPage = React.lazy(() => import('@/pages/stitch/mobile-checkout-page'));
const MobileTrackPage = React.lazy(() => import('@/pages/stitch/mobile-track-page'));

export const mobileRoutes = {
  _tag: 'mobile-routes',
  children: [
    <Route key="mobile-menu" path="/m/:tableId" element={guarded(<MobileMenuPage />)} />,
    <Route key="mobile-cart" path="/m/:tableId/cart" element={guarded(<MobileCartSheet />)} />,
    <Route key="mobile-checkout" path="/m/:tableId/checkout" element={guarded(<MobileCheckoutPage />)} />,
    <Route key="mobile-track" path="/m/:tableId/track" element={guarded(<MobileTrackPage />)} />,
  ],
};
```

---

## 3.5 Deprecation Plan for Old Pages

### Pages to Archive (move to `src/pages/_deprecated/`)
```
src/pages/
├── AboutUs.tsx → /about (StitchAbout)
├── Checkin.tsx → /m/:tableId/checkin (mobile)
├── checkout.tsx → /checkout (CheckoutPage)
├── Contact.tsx → /contact (ContactPage)
├── events.tsx → /events (EventsPage)
├── KDS.tsx → /admin/kds (KitchenDisplaySystem)
├── loyalty.tsx → /loyalty (LoyaltyPage)
├── menu.tsx → /menu (DigitalMenuPage)
├── order-failure.tsx → /order/failure/:id (OrderFailurePage)
├── order-success.tsx → /order/success/:id (OrderSuccessPage)
├── promotions.tsx → /promotions (PromotionsPage)
├── referral.tsx → /reserve (ReservationPage)
├── home.tsx → / (LandingPage)
├── brand-guideline-colors.ts → tokens
├── BrandGuideline.tsx → /admin/settings/branding
├── loyalty-calculator.tsx → /loyalty (LoyaltyPage)
├── loyalty-*.tsx → components/aura/patterns/LoyaltyCalculator
├── materials-section.tsx → /about (StitchAbout)
└── container/ → merge into landing/about
```

### Admin Pages to Archive (142 → 12)
```
src/pages/admin/
├── *.tsx files not in the 12 target routes → _deprecated/
├── Keep: AdminLayout, AdminSidebar, AuditLogViewer, BroadcastPage, BirthdayConfig, CampaignsManager
├── Consolidate: TableOrder*, POS*, ProductList*, CategoryList*, User*, Shift*, Tip*, Inventory*, Sales*, Payout*, Tax* → 6 target pages
```

---

## 3.6 Acceptance Criteria

### Public Pages
- [ ] 12 routes implemented with Aura shells + primitives
- [ ] All Stitch design parity verified visually
- [ ] i18n keys for all strings (vi/en)
- [ ] Mobile responsive at 320px, 375px, 768px, 1024px
- [ ] Lighthouse Perf ≥ 90, A11y ≥ 95

### Admin Pages
- [ ] 12 routes replace 142 legacy pages
- [ ] All CRUD operations functional
- [ ] DataTable with sorting, filtering, pagination, bulk actions
- [ ] Real-time updates via WebSocket (orders, KDS)
- [ ] Role-based access control (owner/manager/staff/waiter)

### Mobile Pages
- [ ] 4 routes for QR ordering flow
- [ ] Touch targets ≥ 44×44px
- [ ] Bottom sheet cart with swipe handling
- [ ] Offline-capable (cache menu, queue orders)

### Routing
- [ ] No route conflicts
- [ ] Lazy loading works for all routes
- [ ] ErrorBoundary catches all route errors
- [ ] AuthGuard protects admin routes

---

## File Ownership Matrix

| Area | Files | Owner |
|------|-------|-------|
| Public Pages | `src/pages/stitch/*-page/` | Public Team |
| Admin Pages | `src/pages/admin/*/` | Admin Team |
| Mobile Pages | `src/pages/stitch/mobile-*-page/` | Mobile Team |
| Route Configs | `src/routes/*-routes.tsx` | Frontend Core |
| Deprecated | `src/pages/_deprecated/` | Archive (no owner) |

---

## Rollback Plan
- Feature flags per route group: `ENABLE_NEW_PUBLIC_ROUTES`, `ENABLE_NEW_ADMIN_ROUTES`, `ENABLE_NEW_MOBILE_ROUTES`
- Old routes remain at `/legacy/*` during transition
- Canary deploy to 10% traffic first

---

## Next Phase Dependency
Phase 4 (Real-time) can start once `/admin/orders` and `/m/:tableId/track` are functional.