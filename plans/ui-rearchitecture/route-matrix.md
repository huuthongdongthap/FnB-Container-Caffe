# AURA OS — Route Matrix & Ownership Audit

This matrix maps all 89 route endpoints registered across `src/App.tsx`, `src/routes/public-routes.tsx`, `src/routes/stitch-routes.tsx`, `src/routes/admin-routes.tsx`, and `src/routes/mobile-routes.tsx`.

---

## 1. Executive Summary of Route Governance Defects

1. **Shell Misplacement in `stitchRoutes`**: `stitchRoutes` is wrapped inside `<CustomerShell />` in `App.tsx`, yet it contains operational and HQ endpoints:
   - `/stitch/kds` (Kitchen Display)
   - `/stitch/order-management` (POS/Terminal)
   - `/stitch/admin-terminal` (Admin Console)
   - `/stitch/admin-orders` (Admin Order Management)
   - `/stitch/admin-pos` (Admin POS)
   - `/stitch/admin-v2` (Admin Portal)
   *Impact:* Customer navigation bar, customer top app bar, and customer cart overlay are mounted on top of operational KDS and Admin consoles.
2. **Orphan Shell in `mobileRoutes`**: Mounted in `App.tsx` outside any of the 3 primary shells (`CustomerShell`, `OpsShell`, `AdminShell`). Uses its own `MobileLayout` with custom inline styles and separate tab bar.
3. **Admin Shell Bypassed**: `adminRoutes` imports `AdminLayout` from `@/pages/admin/AdminLayout` instead of wrapping with the canonical `AdminShell`.
4. **CartBottomBar Leakage**: Rendered at `App.tsx:68` outside `<Routes>`. Renders on all routes if cart has items.

---

## 2. Exhaustive Route Inventory (89 Routes)

### A. Operations Shell Routes (`OpsShell`)

| Path | Component Module | Current Shell Wrapping | Target Authoritative Shell | Guard / Auth | Notes / Action |
|---|---|---|---|---|---|
| `/kds` | `@/pages/KDS` | OpsShell | **OpsShell** | Public / Station Token | Core KDS |
| `/tv-menu` | `@/pages/TVMenu` | OpsShell | **OpsShell** | Public Display | Digital Board |
| `/pos/table/:tableId` | `@/pages/TableOrder` | OpsShell | **OpsShell** | Staff / Station | Table POS |

### B. Customer Shell Routes (`CustomerShell` — Public & Customer IA)

| Path | Component Module | Current Shell Wrapping | Target Authoritative Shell | IA Tab / Role | Notes / Action |
|---|---|---|---|---|---|
| `/` | `@/pages/home` | CustomerShell | **CustomerShell** | Tab 1 (Trang chủ) | Canonical Home |
| `/container` | `@/pages/container` | CustomerShell | **CustomerShell** | Sub (Trang chủ) | Concept Landing |
| `/menu` | `@/pages/menu` | CustomerShell | **CustomerShell** | Tab 2 (Thực đơn) | Canonical Menu (M4-B) |
| `/menu/:id` | `@/pages/menu` | CustomerShell | **CustomerShell** | Tab 2 Detail | Product Detail |
| `/table-reservation` | `@/pages/stitch/reservation-new` | CustomerShell | **CustomerShell** | Tab 3 (Đặt bàn) | Canonical Booking |
| `/promotions` | `@/pages/stitch/promotions-new` | CustomerShell | **CustomerShell** | Tab 4 (Ưu đãi) | Canonical Promotions |
| `/events` | `@/pages/events` | CustomerShell | **CustomerShell** | Sub (Ưu đãi) | Events Listing |
| `/account` | `@/pages/account` | CustomerShell | **CustomerShell** | Tab 5 (Cá nhân) | Customer Account |
| `/loyalty` | `@/pages/loyalty` | CustomerShell | **CustomerShell** | Sub (Cá nhân) | Loyalty Points |
| `/referral` | `@/pages/referral` | CustomerShell | **CustomerShell** | Sub (Cá nhân) | Referral Program |
| `/subscriptions` | `@/pages/stitch/subscriptions-new` | CustomerShell | **CustomerShell** | Sub (Cá nhân) | Coffee Subscriptions |
| `/checkout` | `@/pages/checkout` | CustomerShell | **CustomerShell** | Flow | Checkout Flow |
| `/order` | `@/pages/TableOrder` | CustomerShell | **CustomerShell** | Flow | Customer In-store Order |
| `/checkin` | `@/pages/stitch/checkin-new` | CustomerShell | **CustomerShell** | Flow | QR Checkin |
| `/track-order` | `@/pages/stitch/track-order` | CustomerShell | **CustomerShell** | Flow | Live Tracking |
| `/order-success` | `@/pages/order-success` | CustomerShell | **CustomerShell** | Flow | Success Confirmation |
| `/order-failure` | `@/pages/stitch/order-failure` | CustomerShell | **CustomerShell** | Flow | Failure & Retry |
| `/table-checkin` | `@/pages/TableCheckin` | CustomerShell | **CustomerShell** | Legacy | Merge candidate -> `/checkin` |
| `/about` | `@/pages/stitch/our-story` | CustomerShell | **CustomerShell** | Content | Brand Story |
| `/reviews` | `@/pages/stitch/customer-reviews` | CustomerShell | **CustomerShell** | Content | Customer Reviews |
| `/contact` | `@/pages/stitch/contact-new` | CustomerShell | **CustomerShell** | Content | Contact Us |
| `/brand` | `@/pages/BrandGuideline` | CustomerShell | **CustomerShell** | Dev / Brand | Internal Reference |
| `/gallery` | `@/pages/stitch/gallery-new` | CustomerShell | **CustomerShell** | Content | Photo Gallery |
| `/loyalty-calculator` | `@/pages/stitch/loyalty-calc` | CustomerShell | **CustomerShell** | Utility | Integrate into `/loyalty` |
| `/pricing` | `@/pages/[locale]/pricing` | CustomerShell | **CustomerShell** | Marketing | SaaS Pricing |
| `/saas/dashboard` | `@/pages/saas/dashboard` | CustomerShell | **CustomerShell** | SaaS Portal | Separate tenant view |
| `/saas/onboard/tenant` | `@/pages/saas/onboard/tenant-create` | CustomerShell | **CustomerShell** | SaaS Onboard | Tenant Provisioning |
| `/saas/onboard` | `@/pages/saas/onboard` | CustomerShell | **CustomerShell** | SaaS Wizard | Onboarding Steps |
| `/stitch-gallery-screen-showcase` | `@/pages/stitch-screen-gallery` | CustomerShell | **CustomerShell** | Dev Showcase | Dev Only |
| `/vi/order` | `@/pages/TableOrder` | CustomerShell | **CustomerShell** | Locale Order | Localized Order |
| `/en/order` | `@/pages/TableOrder` | CustomerShell | **CustomerShell** | Locale Order | Localized Order |

### C. Stitch Showcase & Prototype Routes (Current In `stitchRoutes`)

| Path | Component Module | Current Shell | Target Shell | Recommendation |
|---|---|---|---|---|
| `/stitch/landing` | `@/pages/stitch/luxury-landing-hero` | CustomerShell | CustomerShell | Showcase/A-B test |
| `/stitch/container-landing` | `@/pages/stitch/luxury-landing` | CustomerShell | CustomerShell | Showcase/A-B test |
| `/stitch/container-cafe-1` | `@/pages/stitch/luxury-cafe-1` | CustomerShell | CustomerShell | Design variant |
| `/stitch/container-cafe-2` | `@/pages/stitch/luxury-cafe-2` | CustomerShell | CustomerShell | Design variant |
| `/stitch/customer-account` | `@/pages/stitch/customer-account` | CustomerShell | CustomerShell | Merge into `/account` |
| `/stitch/loyalty` | `@/pages/stitch/loyalty-rewards` | CustomerShell | CustomerShell | Merge into `/loyalty` |
| `/stitch/referral-1` | `@/pages/stitch/referral-rewards-1` | CustomerShell | CustomerShell | Variant |
| `/stitch/referral-2` | `@/pages/stitch/referral-rewards-2` | CustomerShell | CustomerShell | Variant |
| `/stitch/menu` | `@/pages/stitch/digital-menu` | CustomerShell | CustomerShell | Legacy prototype |
| `/stitch/menu-2` | `@/pages/stitch/digital-menu-2` | CustomerShell | CustomerShell | Variant |
| `/stitch/mobile-ordering` | `@/pages/stitch/mobile-ordering` | CustomerShell | CustomerShell | Mobile view prototype |
| `/stitch/events-1` | `@/pages/stitch/events-promotions-1`| CustomerShell | CustomerShell | Variant |
| `/stitch/events-2` | `@/pages/stitch/events-promotions-2`| CustomerShell | CustomerShell | Variant |
| `/stitch/kds` | `@/pages/stitch/kitchen-display` | CustomerShell | **OpsShell** | **Move to OpsShell** |
| `/stitch/order-management` | `@/pages/stitch/order-management` | CustomerShell | **OpsShell** | **Move to OpsShell** |
| `/stitch/order-success` | `@/pages/stitch/order-success` | CustomerShell | CustomerShell | Variant |
| `/stitch/premium-checkout` | `@/pages/stitch/premium-checkout` | CustomerShell | CustomerShell | Variant |
| `/stitch/admin-terminal` | `@/pages/stitch/admin-terminal` | CustomerShell | **AdminShell** | **Move to AdminShell** |
| `/stitch/admin-orders` | `@/pages/stitch/admin-orders` | CustomerShell | **AdminShell** | **Move to AdminShell** |
| `/stitch/admin-pos` | `@/pages/stitch/admin-pos` | CustomerShell | **AdminShell** | **Move to AdminShell** |
| `/stitch/admin-v2` | `@/pages/stitch/admin-v2` | CustomerShell | **AdminShell** | **Move to AdminShell** |

### D. Admin Shell Routes (`AdminShell`)

| Path | Component Module | Current Wrapping | Target Shell | Guard | Role / Domain |
|---|---|---|---|---|---|
| `/admin/login` | `@/pages/admin/Login` | Unguarded | **AdminShell** | None | Admin Auth |
| `/admin` | `@/pages/admin/Dashboard` | AdminLayout | **AdminShell** | ProtectedRoute | HQ Overview |
| `/admin/dashboard` | `@/pages/admin/Dashboard` | AdminLayout | **AdminShell** | ProtectedRoute | HQ Overview |
| `/admin/audit-logs` | `@/pages/admin/AuditLogViewer` | AdminLayout | **AdminShell** | ProtectedRoute | Security / Audit |
| `/admin/birthday-config` | `@/pages/admin/BirthdayConfig` | AdminLayout | **AdminShell** | ProtectedRoute | CRM Birthday |
| `/admin/broadcasts` | `@/pages/admin/BroadcastPage` | AdminLayout | **AdminShell** | ProtectedRoute | Marketing Broadcast |
| `/admin/campaigns` | `@/pages/admin/CampaignsManager` | AdminLayout | **AdminShell** | ProtectedRoute | Marketing Campaigns |
| `/admin/chat` | `@/pages/admin/ChatInbox` | AdminLayout | **AdminShell** | ProtectedRoute | Live Support Chat |
| `/admin/checkin-approve` | `@/pages/admin/CheckinApprove` | AdminLayout | **AdminShell** | ProtectedRoute | Staff Checkin Review |
| `/admin/customers` | `@/pages/admin/Customers` | AdminLayout | **AdminShell** | ProtectedRoute | CRM Customer Database |
| `/admin/erpnext-sync` | `@/pages/admin/ERPNExtSync` | AdminLayout | **AdminShell** | ProtectedRoute | ERP Integration |
| `/admin/table-management` | `@/pages/admin/TableManagement` | AdminLayout | **AdminShell** | ProtectedRoute | Floor / Table Layout |
| `/admin/generate-qr` | `@/pages/admin/GenerateQR` | AdminLayout | **AdminShell** | ProtectedRoute | Table QR Codes |
| `/admin/invoice-history` | `@/pages/admin/InvoiceHistory` | AdminLayout | **AdminShell** | ProtectedRoute | Billing & Receipts |
| `/admin/manage-menu` | `@/pages/admin/ManageMenu` | AdminLayout | **AdminShell** | ProtectedRoute | Catalog & Menu Admin |
| `/admin/notification-settings` | `@/pages/admin/NotificationSettings` | AdminLayout | **AdminShell** | ProtectedRoute | Notification Config |
| `/admin/metrics` | `@/pages/admin/Metrics` | AdminLayout | **AdminShell** | ProtectedRoute | System Metrics |
| `/admin/orders` | `@/pages/admin/Orders` | AdminLayout | **AdminShell** | ProtectedRoute | Order Management |
| `/admin/pos` | `@/pages/admin/POS` | AdminLayout | **AdminShell** | ProtectedRoute | Admin Cashier POS |
| `/admin/promotions` | `@/pages/admin/PromotionsManager` | AdminLayout | **AdminShell** | ProtectedRoute | Discount / Coupon Admin |
| `/admin/reservations` | `@/pages/admin/Reservations` | AdminLayout | **AdminShell** | ProtectedRoute | Booking Management |
| `/admin/sales-reports` | `@/pages/admin/SalesReports` | AdminLayout | **AdminShell** | ProtectedRoute | Financial Reports |
| `/admin/staff` | `@/pages/admin/Staff` | AdminLayout | **AdminShell** | ProtectedRoute | Staff Accounts & Roles |
| `/admin/subscriptions` | `@/pages/admin/SubscriptionsManager` | AdminLayout | **AdminShell** | ProtectedRoute | Subscription Plan Admin |
| `/admin/dindin/menu` | `@/pages/admin/DinDinMenu` | AdminLayout | **AdminShell** | ProtectedRoute | DinDin Integration |
| `/admin/dindin/cart` | `@/pages/admin/DinDinCart` | AdminLayout | **AdminShell** | ProtectedRoute | DinDin Cart |
| `/admin/dindin/checkout` | `@/pages/admin/DinDinCheckout` | AdminLayout | **AdminShell** | ProtectedRoute | DinDin Checkout |
| `/admin/dindin/success` | `@/pages/admin/DinDinOrderSuccess` | AdminLayout | **AdminShell** | ProtectedRoute | DinDin Success |
| `/admin/devices` | `@/pages/admin/Devices` | AdminLayout | **AdminShell** | ProtectedRoute | Hardware Terminal Mgt |

### E. Mobile/Staff Shell Routes (`mobileRoutes` — Orphaned Shell)

| Path | Component Module | Current Shell | Target Shell | Guard | Action |
|---|---|---|---|---|---|
| `/mobile/login` | `@/pages/mobile/mobile-login` | None | **OpsShell** | None | Staff Station Login |
| `/mobile` | `@/pages/mobile/kitchen-display` | MobileLayout | **OpsShell** | ProtectedRoute | Consolidate into OpsShell |
| `/mobile/kds` | `@/pages/mobile/kitchen-display` | MobileLayout | **OpsShell** | ProtectedRoute | Consolidate into OpsShell |
| `/mobile/orders` | `@/pages/mobile/waiter-orders` | MobileLayout | **OpsShell** | ProtectedRoute | Consolidate into OpsShell |
| `/mobile/tables` | `@/pages/mobile/table-manager` | MobileLayout | **OpsShell** | ProtectedRoute | Consolidate into OpsShell |

### F. Global System Routes

| Path | Component Module | Current Shell | Target Shell | Notes |
|---|---|---|---|---|
| `*` | `@/pages/stitch/not-found` | None | Standalone | 404 Error Page |
