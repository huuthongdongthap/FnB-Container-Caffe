---
title: "i18n — Bilingual (VN+EN) Implementation"
description: "Add full bilingual support with react-i18next framework"
status: pending
priority: P2
tags: [i18n, bilingual, react-i18next, translation]
estimated: 30-50h
---

# i18n Implementation Plan

## Current State
- Zero i18n framework installed
- 70+ files with hardcoded Vietnamese text
- 500+ strings to extract and translate
- 2 Stitch components with basic locale props (StitchCheckout, StitchOrderSuccess)
- Currency formatting hardcoded to vi-VN in 20+ places

## Approach
- **Framework:** `react-i18next` + `i18next` (lightweight, well-supported)
- **Storage:** JSON translation files (`public/locales/{vi,en}/translation.json`)
- **Locale detection:** `i18next-browser-languagedetector`
- **Pattern:** `t('key')` wrapper, `Trans` component for rich text

## Phases

### Phase 1: Setup + Core Framework (5-8h)
- Install react-i18next, i18next, i18next-browser-languagedetector
- Create i18n config + initialization
- Create translation files structure
- Create core translation keys (common, nav, footer, buttons, forms)
- Add language switcher to header
- Test: framework works, language switch works

### Phase 2: Customer-facing pages (10-15h)
- Extract VN text → keys → translate to EN for ALL customer pages:
  - Home, Menu, Checkout, Order tracking
  - About, Contact, Reviews, Events
  - Loyalty, Referral, Promotions
  - Account, Reservations, TV Menu, KDS
- Update all currency formatting to be locale-aware
- Update SEO meta tags with bilingual support

### Phase 3: Admin pages (10-15h)
- Extract VN text → keys → translate to EN for ALL admin pages:
  - Dashboard, Orders, POS, Customers
  - Staff, Reservations, Menu management
  - Campaigns, Broadcast, Chat
  - Analytics, Sales Reports, Audit Logs
  - Refunds, Promotions, Subscriptions
  - Invoice History, QR Generator, Birthday Config
- Admin header/sidebar bilingual

### Phase 4: Backend + API messages (5-8h)
- Worker error messages → bilingual Zod validation
- API response messages bilingual
- Notification templates (ZNS/SMS/Email) bilingual config
- Payment/refund status messages

### Phase 5: Testing + Polish (3-5h)
- Test language switching on every page
- Test EN locale renders correctly (no truncation/overflow)
- Test currency formatting in both locales
- Add E2E tests for locale switching
- Update CEO-HANDOVER.md with i18n instructions

## Technical Design

### i18n Config
```ts
// src/lib/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'vi',
    debug: process.env.NODE_ENV === 'development',
    interpolation: { escapeValue: false },
    resources: {
      vi: { translation: {} }, // loaded from JSON
      en: { translation: {} }, // loaded from JSON
    },
  });
```

### Translation File Structure
```
public/locales/
  vi/
    common.json       # buttons, labels, nav, footer
    home.json         # homepage sections
    menu.json         # menu, categories
    checkout.json     # checkout, payment
    account.json      # account, loyalty, referral
    admin.json        # admin panel
    errors.json       # error messages
    notifications.json # SMS, ZNS, email templates
  en/
    common.json
    home.json
    ...
```

### Component Pattern
```tsx
import { useTranslation } from 'react-i18next';

function MenuPage() {
  const { t } = useTranslation('menu');
  return <h1>{t('title')}</h1>;
}
```

### Currency Formatting
```ts
// src/lib/format.ts
export function formatCurrency(amount: number): string {
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: locale === 'vi-VN' ? 'VND' : 'USD',
  }).format(amount);
}
```

## Files to Modify
- Install: package.json (add react-i18next, i18next, i18next-browser-languagedetector)
- New: src/lib/i18n.ts
- New: public/locales/{vi,en}/*.json (~14 files per locale)
- New: src/lib/format.ts (locale-aware formatting)
- Modify: src/main.tsx (init i18n)
- Modify: src/components/stitch/StitchHeader.tsx (add language switcher)
- Modify: 70+ page/component files (wrap text in t())
- Modify: 20+ files with Intl.NumberFormat (use format.ts)

## Risks
- Text overflow in EN (English strings are longer than VN) — need to test all layouts
- Dynamic/interpolated strings (e.g., "Xin chào {name}") — need proper interpolation
- Plural forms (1 item vs 2 items) — i18next handles this natively
- Date/time formatting — use Intl.DateTimeFormat with locale
