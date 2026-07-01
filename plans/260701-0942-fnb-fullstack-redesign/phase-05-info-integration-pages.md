---
phase: 5
title: "Info + Integration Pages"
status: pending
priority: P3
dependencies: [1]
effort: "4h"
---

# Phase 5: Info + Integration Pages

## Overview

Migrate informational and brand pages: About Us, Contact, Brand Guideline, and 404. Lower-traffic but essential for brand trust and SEO.

**Red-team corrections:** receipt-template.html excluded (worker-only email template). Font stack uses Cormorant Garamond (preserves Bazi migration). No react-helmet-async — use document.title + meta tags in useEffect.

## Pages

| Page | Current | Lines | New Component |
|------|---------|-------|---------------|
| About Us | `about-us.html` | ~320 | `src/pages/AboutUs.tsx` |
| Contact | `contact.html` | ~180 | `src/pages/Contact.tsx` |
| Brand Guideline | `brand-guideline.html` | 601 | `src/pages/BrandGuideline.tsx` |
| 404 | `404.html` | 19 | `src/pages/NotFound.tsx` |

## Architecture

```
src/
├── pages/
│   ├── AboutUs.tsx, Contact.tsx, BrandGuideline.tsx, NotFound.tsx
├── components/
│   ├── about/
│   │   ├── StoryTimeline.tsx, TeamSection.tsx, ContainerConcept.tsx
│   ├── contact/
│   │   ├── ContactForm.tsx, LocationMap.tsx, HoursDisplay.tsx
│   ├── brand/
│   │   ├── ColorPalette.tsx, TypographyShowcase.tsx, LogoUsage.tsx
│   │   ├── BaziExplanation.tsx, ZoneColors.tsx
│   └── shared/
│       ├── SEOHead.tsx         # document.title + meta tags in useEffect (no react-helmet-async)
│       ├── Breadcrumbs.tsx     # structured data breadcrumbs
│       └── SocialShare.tsx     # OG meta + share buttons
├── hooks/
│   ├── useContact.ts       # POST /api/contact
```

## TDD: Tests to Write First

1. `src/components/contact/__tests__/contact-form.test.tsx` — validates name/phone/message, submits to API, success/error states
2. `src/components/about/__tests__/story-timeline.test.tsx` — renders milestones in order, responsive layout
3. `src/components/brand/__tests__/color-palette.test.tsx` — all brand colors with hex labels, copy-on-click
4. `src/components/brand/__tests__/typography-showcase.test.tsx` — Cormorant Garamond + Space Grotesk + Plus Jakarta Sans specimens
5. `src/components/shared/__tests__/seo-head.test.tsx` — sets title/meta/OG tags per page (document.title, not react-helmet-async)
6. `src/components/shared/__tests__/breadcrumbs.test.tsx` — structured data, correct links, current page marked
7. `src/pages/__tests__/not-found.test.tsx` — 404 message, home link, matches design tokens

## Implementation Steps

### 5.1 About Us
- StoryTimeline (Sa Đéc heritage → container concept → today)
- TeamSection with staff cards
- ContainerConcept with CSS-only illustration
- 5-Zone philosophy, Bazi design philosophy

### 5.2 Contact
- ContactForm: name/phone/message (POST /api/contact)
- LocationMap: Google Maps embed (39 Nguyễn Tất Thành, Sa Đéc)
- HoursDisplay: auto-highlight current day, open/closed status
- Social links (Facebook, Zalo, Instagram)

### 5.3 Brand Guideline
- ColorPalette: all brand tokens, copy-on-click hex values
- TypographyShowcase: **Cormorant Garamond** + Space Grotesk + Plus Jakarta Sans (preserve Bazi v5.1 migration from Playfair Display)
- LogoUsage guidelines
- BaziExplanation: 壬 Thủy, 庚/辛 Kim, 乙 Mộc
- ZoneColors: Jade/Sky/Noir/Aura/Steel

### 5.4 404 Page
- Brand-aligned illustration, home link + menu link

### 5.5 SEO + Structured Data
- SEOHead: per-page document.title + meta description + OG tags via useEffect
- JSON-LD structured data (Restaurant, LocalBusiness, Menu, BreadcrumbList)
- Sitemap generation (static + dynamic routes)

## Out of Scope
- **receipt-template.html** — worker-only email template, excluded from React migration. Worker's `worker/src/templates/receipt.js` generates receipts server-side.

## Success Criteria

- [ ] All 7 TDD test files written and passing
- [ ] About Us: timeline, team, concept sections render
- [ ] Contact: form submits to worker API, map loads
- [ ] Brand Guideline: Cormorant Garamond showcased (not Playfair Display SC)
- [ ] 404: brand-aligned, home link functional
- [ ] SEO: meta/OG/structured data on all pages (no react-helmet-async dependency)
- [ ] Lighthouse SEO ≥ 90
- [ ] 0 TypeScript errors, 0 lint errors

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| 601-line brand-guideline.html has complex interactive elements | Extract interactive sections as isolated components |
| Google Maps embed API key needed | Use existing key from static site; static image fallback |
| Structured data must match worker responses | Generate from same types used in API client |
