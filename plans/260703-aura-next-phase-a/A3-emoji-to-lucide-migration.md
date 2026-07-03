# A3: Emoji to Lucide Icon Migration

**Date:** 2026-07-03
**Status:** Planned
**Priority:** P1 Critical
**Source:** UI/UX Pro Max Audit #4 (30+ emoji violations across the app); DESIGN.md states "Don't: Use emoji for icons — use SVG or Lucide icons"
**Effort:** 3-4 hours
**Dependencies:** None (cosmetic substitution, can run in parallel with A1/A2)
**Blocks:** A4 (test suite may find emoji-related test failures)

---

## 1. Technical Design

### Problem Statement

30+ emoji characters are used as icons across the application. Emojis render inconsistently across platforms (Google vs Apple vs Windows), lack proper accessibility semantics, and violate the DESIGN.md brand guideline requiring Lucide/SVG icons. This cheapens the industrial-luxury brand experience.

Each emoji must be replaced with the equivalent Lucide icon component. Lucide is already a dependency in `package.json` (`lucide-react: ^1.22.0`).

### Architecture

The migration is a mechanical 1:1 substitution. Each emoji maps to a Lucide icon:

| Emoji | Lucide Icon | Size | Context |
|-------|-------------|------|---------|
| `💬` | `MessageCircle` | 20px | Chat, ZNS channel icon |
| `📱` | `Smartphone` | 20px | SMS channel icon |
| `📧` | `Mail` | 20px | Email channel icon |
| `📨` | `Send` | 20px | "All" channel / Send button |
| `📢` | `Megaphone` | 20px | Broadcast header |
| `📋` | `ClipboardList` | 16px | Preview text, details |
| `✅` | `CheckCircle` | 20px | Confirm/success states |
| `⚠️` | `AlertTriangle` | 16px | Warning messages |
| `🎉` | `PartyPopper` | 20px | Welcome campaign |
| `🎂` | `Cake` | 20px | Birthday campaign |
| `💌` | `Heart` | 20px | Winback campaign |
| `⭐` | `Star` | 16px | Post-visit campaign |
| `👥` | `Users` | 24px | Customer empty state |
| `📄` | `FileText` | 32px | Invoice empty state |
| `🔍` | `Search` | 16px | Search empty state |
| `☕` | `Coffee` | various | Coffee/cafe references |
| `📍` | `MapPin` | 16px | Location (already used in Footer) |
| `🌿` | `Leaf` | 16px | Nature zone |
| `🌅` | `Sunrise` | 16px | Sky Deck zone |
| `🛋️` | `Sofa` | 16px | Lounge zone |
| `🌇` | `Building2` | 16px | City view zone |
| `🏗️` | `Construction` | 16px | Container zone |
| `🧊` | `Snowflake` | 16px | Iced drinks |
| `🍵` | `Wine` | 16px | Hot drinks |
| `🥤` | `CupSoda` | 16px | Sodas |
| `🍊` | `Citrus` | 16px | Citrus drinks |
| `🥛` | `Milk` | 16px | Milk drinks |
| `🍹` | `Drink` | 16px | Cocktails |
| `💰` | `DollarSign` | 20px | Revenue/money |
| `💵` | `DollarSign` | 16px | Cash payment |
| `🏦` | `Landmark` | 16px | Bank/PayOS payment |
| `🔒` | `Lock` | 14px | Secure checkout |
| `✨` | `Sparkles` | 14px | Features |
| `🤝` | `Handshake` | 16px | Partnership |
| `📞` | `Phone` | 16px | Contact |
| `📅` | `Calendar` | 14px | Delivery date |
| `⚡` | `Zap` | 14px | Express/fast |

### Key Design Decisions

1. **Standalone Lucide icon components** — Use `<IconName size={n} className="..." aria-hidden="true" />` pattern throughout. Import from `lucide-react`.

2. **Accessibility** — All decorative icons get `aria-hidden="true"`. Informational icons get `aria-label`. This fixes the accessibility gap from the audit (finding 4.1).

3. **Channel icons** — For BroadcastPage `CHANNEL_OPTIONS`, replace the `icon: string` (emoji) with a `LucideIcon` component reference:

   ```typescript
   // Before
   const CHANNEL_OPTIONS = [
     { value: 'zns', label: 'Zalo ZNS', icon: '💬' },
   ];
   
   // After  
   import { MessageCircle, Smartphone, Mail, Send } from 'lucide-react';
   const CHANNEL_OPTIONS = [
     { value: 'zns', label: 'Zalo ZNS', icon: MessageCircle },
   ];
   ```

4. **Campaign emoji mapping** — Replace `TRIGGER_EMOJI` string values with Lucide icon component references, updating the `Record` type accordingly.

5. **Category emoji in menu** — Replace the `CATEGORY_EMOJI` mapping with `CATEGORY_ICON` using Lucide components.

---

## 2. File List

### Files to Modify

| # | File | Emojis | Change |
|---|------|--------|--------|
| 1 | `src/pages/admin/BroadcastPage.tsx` | `💬📱📧📨📢📋✅⚠️📨` | Replace CHANNEL_OPTIONS icons with Lucide component refs. Replace all inline emoji in JSX with Lucide components. |
| 2 | `src/pages/admin/CampaignsManager.tsx` | `🎉🎂💌⭐` | Replace TRIGGER_EMOJI values with Lucide components. Change type from `Record<Trigger, string>` to `Record<Trigger, React.ComponentType<{size?: number}>>`. |
| 3 | `src/pages/admin/Customers.tsx` | `👥` | Replace inline emoji with `<Users />` component. |
| 4 | `src/pages/admin/ChatInbox.tsx` | `💬` | Replace with `<MessageCircle />` component. |
| 5 | `src/pages/admin/InvoiceHistory.tsx` | `📄` | Replace with `<FileText />` component. |
| 6 | `src/pages/AboutUs.tsx` | `☕🌱🤝✨👨‍💼👩‍🍳👨‍🎨👩‍💼👨‍🔧👩‍🎤` | Replace all emoji. Team member emoji → use avatar initials or Lucide `User` icon. |
| 7 | `src/pages/Contact.tsx` | `📞` | Already has MapPin + Phone Lucide icons. Replace remaining `📞` emoji. |
| 8 | `src/pages/ReviewsPage.tsx` | `☕` | Replace empty-state emoji with `<Coffee />` icon. |
| 9 | `src/components/menu/menu-card.tsx` | `☕🧊🍵🥤🍊🥛🫧🍹🥐🎯🧴🍽️` | Replace CATEGORY_EMOJI mapping with CATEGORY_ICON using Lucide components. |
| 10 | `src/components/menu/menu-grid.tsx` | `🔍` | Replace search empty state with `<Search />` icon. |
| 11 | `src/components/order/checkout-form.tsx` | `⚡📅⚡🔒` | Replace with `<Zap />`, `<Calendar />`, `<Lock />` icons. |
| 12 | `src/components/order/payment-method-selector.tsx` | `💵🏦` | Replace with `<DollarSign />`, `<Landmark />` icons. |
| 13 | `src/components/order/delivery-info.tsx` | `📍` | Already uses MapPin. Verify. |
| 14 | `src/components/home/five-zone-showcase.tsx` | `🌿🌅🛋️🌇🏗️` | Replace zone icons with Lucide equivalents. |
| 15 | `src/components/home/hero-section.tsx` | emoji in badges | Replace with Lucide icons (verified `✨` usage). |
| 16 | `src/components/admin/StatsCard.tsx` | `💰` icon prop | Replace emoji icon with `<DollarSign />` SVG inline or Lucide component. |

### Files to Create

None. All changes are replacing emoji string values with Lucide component references.

---

## 3. Database Changes

None.

---

## 4. API Endpoints

None.

---

## 5. Frontend Components

No new components. 16 existing files get emoji string → Lucide component substitutions.

---

## 6. Tests

### Unit Tests

| Test | Purpose |
|------|---------|
| `src/pages/admin/__tests__/BroadcastPage.test.tsx` | Verify channel icons render Lucide components (not emoji strings) |
| `src/pages/admin/__tests__/CampaignsManager.test.tsx` | Verify trigger icons render as Lucide |
| `src/components/menu/__tests__/menu-card.test.tsx` | Verify category icons render without emoji |

### E2E Tests

- Playwright: screenshot test for BroadcastPage, CampaignsManager, AboutUs — verify no emoji characters in rendered output.

### Build Verification
```
npm run build    # Must pass (verify all imports resolve)
npm test         # All 1184 tests pass  
```

### Emoji Detection Script
```bash
# Verify zero emoji remain
grep -rnP '[\x{1F300}-\x{1FAFF}]' src/ --include="*.tsx" --include="*.ts" | grep -v __tests__ | grep -v node_modules | grep -v '.test.'
# Should return 0 matches
```

---

## 7. Acceptance Criteria

- [ ] Zero emoji characters in production code (`src/`)
- [ ] All emoji replaced with Lucide icon components
- [ ] All decorative Lucide icons have `aria-hidden="true"`
- [ ] All informational icons have appropriate `aria-label`
- [ ] Broadcast channel options show Lucide icons, not emoji
- [ ] Campaign triggers show Lucide icons, not emoji
- [ ] Menu category icons use Lucide components
- [ ] About Us team section uses avatar/icon instead of emoji faces
- [ ] Zone showcase shows themed Lucide icons
- [ ] Admin dashboard stats use Lucide icons
- [ ] `npm run build` = 0 errors
- [ ] `npm test` = all tests pass
- [ ] Emoji grep check returns 0 matches (excluding third-party/node_modules)
- [ ] No console.log output in production code

---

## 8. Rollback Plan

### If imports fail (wrong icon name)
```bash
# Check for invalid Lucide icon imports
grep -rn "from 'lucide-react'" src/pages/admin/BroadcastPage.tsx
# Verify icon exists: grep name lucide-react/src/icons/

# Revert specific file
git checkout -- src/pages/admin/BroadcastPage.tsx
```

### If build breaks from icon type mismatches
```bash
# Common issue: using LucideIcon as a string
# TypeScript error: Type 'LucideIcon' not assignable to type 'string'
# Fix: change type from string to LucideIcon | React.FC<{size?: number}>

# Revert icon map changes
git checkout -- src/pages/admin/CampaignsManager.tsx
```

### Global rollback
```bash
git checkout HEAD~16 -- src/pages/ src/components/
npm run build
npm test
```

---

## 9. Estimated Effort

| Task | Time |
|------|------|
| BroadcastPage emoji migration | 30 min |
| CampaignsManager trigger icons | 15 min |
| Customers, ChatInbox, InvoiceHistory empty states | 10 min |
| AboutUs (heaviest per-page emoji usage) | 30 min |
| Contact, ReviewsPage | 10 min |
| Menu card category icons | 20 min |
| Menu grid, checkout form, payment, delivery | 20 min |
| Five zone showcase icons | 15 min |
| Hero section badges | 10 min |
| StatsCard icon prop fix | 10 min |
| Build + test + emoji scan verification | 15 min |
| **Total** | **~3h** |
