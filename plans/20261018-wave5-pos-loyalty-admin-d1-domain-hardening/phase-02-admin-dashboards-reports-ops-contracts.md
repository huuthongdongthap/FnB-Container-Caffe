# Phase 02: Admin Dashboards, SalesReports, Metrics, Promotions, Campaigns, Broadcast, AuditLog, Devices, NotificationSettings, ManageMenu, ChatInbox, BirthdayConfig, ERPNExtSync & InvoiceHistory

## Context Links
- Brainstorm Report: `plans/20261018-wave5-pos-loyalty-admin-d1-domain-hardening/reports/brainstorm-20261018-wave5-deep-audit.md`
- Overview Plan: `plans/20261018-wave5-pos-loyalty-admin-d1-domain-hardening/plan.md`

## Overview
- **Priority**: P0
- **Status**: Complete
- **Description**: Align Admin pages, hooks, stores, and locale files with backend API contracts, fix silent error handling and broken toggles/inputs, and resolve M3 dark contrast issues.

## Key Insights
- `Dashboard.tsx` triggers duplicate `/api/stats` and `/api/admin/orders` requests via `useAdmin()` while also calling `useAdminDashboardStore` and `useAdminOrdersStore`, and `period` (`7d`/`30d`) is never sent to `fetchDashboard`.
- `use-sales-report-data.ts:68` requests `/api/reports/export?type=sales`, which returns HTTP 400 from the Worker.
- `metric-cards.tsx:21-31` appends `%` twice (`100.0%%` / `N/A%`).
- `CampaignsManager-edit-modal.tsx:111-123` renders a static `<span>` for `is_active` instead of an interactive switch.
- `src/locales/{vi,en}.json` uses single-brace `{var}` instead of `{{var}}` in `broadcast`, `campaigns`, and `erpnextSync`.
- `use-product-manager.ts:29` converts `category_id` with `Number(formData.category_id)`, turning `'cat_...'` into `NaN -> null` and failing Zod string validation on product create/edit.
- `BirthdayConfig.tsx` uses `text-[var(--aura-chrome-dark)]` (`#4A6B85` on `#0E1322`, 3.1:1 contrast) and lacks input clamping.
- `invoice-history-table.tsx:73` uses an unauthenticated `<a href="/api/erpnext-invoices/${id}/pdf">` for a Bearer-protected JSON endpoint.

## Requirements
- Prevent duplicate stats/orders polling in `Dashboard.tsx` / `use-admin.ts`, wire `period` into `fetchDashboard`, surface export errors in `Dashboard-hooks.ts`, and allow `'admin'` & `'manager'` in `OrderTable-refund-action.tsx`.
- Fix `use-sales-report-data.ts` export `type=revenue` and `SalesReports.tsx` error binding; fix `metric-cards.tsx` double `%` and `use-performance-store.ts` range support.
- Make `is_active` interactive in `CampaignsManager-edit-modal.tsx`, render `saveError`/`deleteError` in `CampaignsManager.tsx` and `PromotionsManager.tsx`, and fix `{var}` -> `{{var}}` in `src/locales/{vi,en}.json` and `public/locales/{vi,en}/translation.json`.
- Guard `dateRangeInvalid` in `use-audit-store.ts` and call `/api/admin/audit-logs/export` in `AuditLogViewer.tsx` with client fallback.
- Check `data.sent` in `use-notification-subscriptions.ts` (`testSend`) and only set `saved = true` on success in `use-notification-settings.ts`.
- Pass `category_id: String(formData.category_id)` in `use-product-manager.ts:29`, preserve `is_variable_price` in `openEditModal`, fix `<Badge variant=...>` and `colSpan={5}` in `product-list.tsx`, and surface delete errors in `use-product-manager.ts` & `use-category-manager.ts`.
- Fix bubble alignment in `ChatInbox-detail-view.tsx`, contrast & clamping in `BirthdayConfig.tsx` / `birthday-toggle.tsx`, query invalidation in `ERPNExtSync.tsx`, and authenticated PDF download in `invoice-history-table.tsx`.

## Related Code Files
- Modify:
  - `src/pages/admin/Dashboard.tsx`
  - `src/pages/admin/Dashboard-hooks.ts`
  - `src/pages/admin/Dashboard-sections.tsx`
  - `src/hooks/use-admin.ts`
  - `src/hooks/stores/admin/use-admin-dashboard-store.ts`
  - `src/components/admin/OrderTable-refund-action.tsx`
  - `src/pages/admin/SalesReports.tsx`
  - `src/pages/admin/use-sales-report-data.ts`
  - `src/components/admin/metric-cards.tsx`
  - `src/hooks/stores/admin/use-performance-store.ts`
  - `src/pages/admin/PromotionsManager.tsx`
  - `src/pages/admin/use-promotions-manager.ts`
  - `src/pages/admin/CampaignsManager.tsx`
  - `src/pages/admin/CampaignsManager-edit-modal.tsx`
  - `src/pages/admin/BroadcastPage.tsx`
  - `src/pages/admin/AuditLogViewer.tsx`
  - `src/hooks/stores/admin/use-audit-store.ts`
  - `src/pages/admin/use-notification-settings.ts`
  - `src/pages/admin/use-notification-subscriptions.ts`
  - `src/pages/admin/use-product-manager.ts`
  - `src/pages/admin/use-category-manager.ts`
  - `src/pages/admin/product-list.tsx`
  - `src/pages/admin/ChatInbox-detail-view.tsx`
  - `src/pages/admin/BirthdayConfig.tsx`
  - `src/pages/admin/birthday-toggle.tsx`
  - `src/pages/admin/ERPNExtSync.tsx`
  - `src/pages/admin/invoice-history-table.tsx`
  - `src/locales/vi.json`
  - `src/locales/en.json`
  - `public/locales/vi/translation.json`
  - `public/locales/en/translation.json`

## Todo List
- [x] Fix Dashboard duplicate queries, `period` param, export error handling, and `OrderTable-refund-action` roles
- [x] Fix SalesReports CSV export, MetricCards `%` unit, and PerformanceStore range
- [x] Fix CampaignEditModal `is_active` switch, `{{var}}` i18n interpolation, AuditLog export/filter guard, and NotificationSettings error handling
- [x] Fix ManageMenu `category_id` string serialization & `ProductList` Badge/colSpan, `ChatInbox` bubble alignment, `BirthdayConfig` contrast/clamping, `ERPNExtSync`, and `invoice-history-table` PDF action
