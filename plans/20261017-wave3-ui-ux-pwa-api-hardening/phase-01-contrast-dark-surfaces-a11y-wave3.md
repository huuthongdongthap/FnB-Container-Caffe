# Phase 01: Remaining P0/P1 Dark Contrast Leaks, OG Image Asset & WCAG 2.1 AA

## Context Links
- [Plan Overview](plan.md)
- Code Standards: `docs/design-guidelines.md`, `.claude/rules/m3-strict.md`

## Overview
- **Priority**: P0 (Critical Visual & Accessibility)
- **Status**: Pending
- **Description**: Eliminate all remaining dark-text-on-dark-surface (`bg-red-500/10 text-red-700/800`, `text-yellow-700`, `text-amber-800`) and bright pastel boxes (`bg-amber-50`, `bg-green-50`, `bg-red-50`, `bg-blue-50`) across Auth, Check-in, Order Summary, and Admin pages; replace legacy `#F97316` in `push-notification-toggle*`; fix `DEFAULT_OG_IMAGE` in `HelmetHead.tsx` to an existing photo in `public/photos/`; and add missing `aria-label` / keyboard handlers.

## Key Insights
- Wave 1/2 converted several alert backgrounds to `bg-red-500/10` or `bg-yellow-500/10` while leaving `text-red-700`/`text-red-800`/`text-yellow-700`, yielding 1.7:1–2.8:1 contrast on `#0A1A2E`.
- `DEFAULT_OG_IMAGE` in `src/components/seo/HelmetHead.tsx:12` points to `/photos/space-exterior-overview.webp`, which does not exist in `public/photos/` (actual files are `IMG_6554-frame.webp`..`IMG_6703.webp`).

## Requirements
- **Functional**: Valid `DEFAULT_OG_IMAGE` (`/photos/IMG_6558.webp`), accessible switches/buttons/dialogs (`aria-label`, `Escape` key handler).
- **Non-Functional**: WCAG 2.1 AA contrast >= 4.5:1 on all alert banners, badges, and cards; zero `#F97316` orange in `push-notification-toggle*`.

## Related Code Files
- `src/components/seo/HelmetHead.tsx`
- `src/components/auth/LoginForm.tsx`
- `src/components/auth/RegisterForm.tsx`
- `src/components/checkin/PhotoUpload.tsx`
- `src/components/checkin/ApprovalStatus.tsx`
- `src/components/checkin/CheckinForm.tsx`
- `src/components/order/order-summary.tsx`
- `src/components/admin/StuckPaymentsCard.tsx`
- `src/components/admin/OrderTable-refund-action.tsx`
- `src/components/admin/OrderTable-status-actions.tsx`
- `src/pages/TableReservation-SuccessModal.tsx`
- `src/pages/admin/{AuditLogViewer.tsx,Dashboard.tsx,Dashboard-sections.tsx,GenerateQR.tsx,InvoiceHistory.tsx,SubscriptionsManager.tsx,cancel-sub-modal.tsx,plan-modal.tsx,promotion-form-modal.tsx,CampaignsManager.tsx,CheckinApprove.tsx,Devices.tsx,Devices-table.tsx,Metrics.tsx,category-modal.tsx,BroadcastPage.tsx,NotificationSettings.tsx,notification-preferences.tsx,subscription-test-results.tsx}`
- `src/components/pwa/push-notification-toggle.tsx`
- `src/components/pwa/push-notification-toggle-styles.ts`
- `src/components/staff/notification-settings.tsx`

## Implementation Steps
1. Update `DEFAULT_OG_IMAGE` in `src/components/seo/HelmetHead.tsx` to `'/photos/IMG_6558.webp'`.
2. Replace `text-red-700`/`text-red-800` and `bg-red-50` with `bg-red-500/10 border-red-500/30 text-red-300` across `LoginForm.tsx`, `RegisterForm.tsx`, and all Admin error banners (`Dashboard.tsx`, `Dashboard-sections.tsx`, `GenerateQR.tsx`, `InvoiceHistory.tsx`, `SubscriptionsManager.tsx`, `cancel-sub-modal.tsx`, `plan-modal.tsx`, `promotion-form-modal.tsx`, `CampaignsManager.tsx`, `CheckinApprove.tsx`, `Devices.tsx`, `Metrics.tsx`, `category-modal.tsx`, `BroadcastPage.tsx`, `NotificationSettings.tsx`, `subscription-test-results.tsx`).
3. Update `StuckPaymentsCard.tsx`, `AuditLogViewer.tsx`, `OrderTable-refund-action.tsx`, `OrderTable-status-actions.tsx`, `Devices-table.tsx`, `ApprovalStatus.tsx`, `CheckinForm.tsx`, `PhotoUpload.tsx`, `order-summary.tsx`, `TableReservation-SuccessModal.tsx`, `notification-preferences.tsx`, and `src/components/staff/notification-settings.tsx` to use M3 dark translucent surfaces (`bg-amber-500/10 text-amber-300`, `bg-emerald-500/10 text-emerald-300`, `bg-sky-500/10 text-sky-300`, `bg-surface`).
4. Replace `#F97316` in `push-notification-toggle.tsx` and `push-notification-toggle-styles.ts` with `var(--aura-gold, #C9A84C)` / `rgba(201,168,76,0.14)`.
5. Add `ariaLabel` prop to `ToggleSwitch` in `src/pages/admin/notification-preferences.tsx`.

## Todo List
- [ ] Fix `DEFAULT_OG_IMAGE` in `HelmetHead.tsx`
- [ ] Fix P0/P1 contrast in Auth, Checkin, Order Summary, and Admin components
- [ ] Replace `#F97316` in `push-notification-toggle*`
- [ ] Add `ariaLabel` to `ToggleSwitch` in `notification-preferences.tsx`

## Success Criteria
- Zero `text-red-700`/`text-red-800`/`text-yellow-700`/`text-amber-800` on dark backgrounds; `DEFAULT_OG_IMAGE` resolves to an existing file in `public/photos/`.
