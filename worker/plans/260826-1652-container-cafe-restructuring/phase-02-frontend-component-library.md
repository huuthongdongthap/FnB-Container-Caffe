# Phase 2: Frontend Component Library Unification

**Duration:** Week 2-3  
**Owner:** Frontend Core Team  
**Dependencies:** Phase 1.1 (OpenAPI types for API client)

---

## 2.1 Create `@/components/aura` Design System Package

**Token source of truth:** AURA v6.1 "Rustic Light" palette — see [appendix-design-tokens-rustic-light.md](./appendix-design-tokens-rustic-light.md) for full values. Summary: light surfaces are DEFAULT (`--aura-bg-page` #F7F4EE warm lime-wash off-white, `--aura-bg-card` #FFFFFF, `--aura-bg-sunken` #EFEAE0 cement-tile beige); brand = Forest Green #4A7C59 + Container Blue #2E5E8C + Wood Amber #C08A3E; text = warm charcoal #2B2B26 on light. Glassmorphism is DEMOTED: solid warm surfaces by default, glass blur only for sticky nav rendered over hero photography. Variable NAMES remain `--aura-*`.

### Directory Structure
```
src/components/aura/
├── index.ts                          # Public API exports
├── tokens/
│   ├── index.ts                      # Token constants (colors, spacing, radius, etc.)
│   ├── colors.ts                     # CSS var → TS map
│   ├── typography.ts                 # Font stacks, scales, line heights
│   ├── spacing.ts                    # 4px base unit scale
│   ├── radius.ts                     # Border radius tokens
│   ├── shadows.ts                    # Elevation/shadow tokens
│   ├── motion.ts                     # Duration, easing, stagger
│   └── breakpoints.ts                # Mobile-first breakpoints
├── primitives/
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.stories.tsx
│   │   ├── Button.test.tsx
│   │   ├── variants.ts               # cva variants
│   │   └── index.ts
│   ├── Input/
│   │   ├── Input.tsx
│   │   ├── TextArea.tsx
│   │   ├── Select.tsx
│   │   ├── variants.ts
│   │   └── index.ts
│   ├── Chip/
│   │   ├── Chip.tsx
│   │   ├── FilterChip.tsx
│   │   ├── ActionChip.tsx
│   │   └── index.ts
│   ├── Badge/
│   │   ├── Badge.tsx
│   │   ├── StatusBadge.tsx
│   │   └── index.ts
│   ├── Avatar/
│   │   ├── Avatar.tsx
│   │   ├── AvatarGroup.tsx
│   │   └── index.ts
│   ├── Icon/
│   │   ├── Icon.tsx                  # Material Symbols wrapper
│   │   ├── icons.ts                  # Named exports
│   │   └── index.ts
│   ├── Card/
│   │   ├── Card.tsx                  # Solid warm surface base (glass variant reserved for sticky nav)
│   │   ├── CardHeader.tsx
│   │   ├── CardContent.tsx
│   │   ├── CardFooter.tsx
│   │   └── index.ts
│   ├── Modal/
│   │   ├── Modal.tsx
│   │   ├── ModalHeader.tsx
│   │   ├── ModalBody.tsx
│   │   ├── ModalFooter.tsx
│   │   ├── useModal.ts
│   │   └── index.ts
│   ├── Sheet/
│   │   ├── Sheet.tsx                 # Bottom sheet (mobile)
│   │   ├── SheetHandle.tsx
│   │   └── index.ts
│   ├── Dropdown/
│   │   ├── Dropdown.tsx
│   │   ├── DropdownMenu.tsx
│   │   ├── DropdownItem.tsx
│   │   └── index.ts
│   ├── Table/
│   │   ├── Table.tsx
│   │   ├── TableHeader.tsx
│   │   ├── TableBody.tsx
│   │   ├── TableRow.tsx
│   │   ├── TableCell.tsx
│   │   ├── TableSkeleton.tsx
│   │   └── index.ts
│   ├── Tabs/
│   │   ├── Tabs.tsx
│   │   ├── TabList.tsx
│   │   ├── TabTrigger.tsx
│   │   ├── TabContent.tsx
│   │   └── index.ts
│   ├── Toast/
│   │   ├── Toast.tsx
│   │   ├── ToastProvider.tsx
│   │   ├── useToast.ts
│   │   └── index.ts
│   ├── Skeleton/
│   │   ├── Skeleton.tsx
│   │   ├── SkeletonText.tsx
│   │   ├── SkeletonCard.tsx
│   │   └── index.ts
│   ├── Divider/
│   │   ├── Divider.tsx
│   │   └── index.ts
│   ├── Tooltip/
│   │   ├── Tooltip.tsx
│   │   └── index.ts
│   └── Progress/
│       ├── Progress.tsx
│       ├── CircularProgress.tsx
│       └── index.ts
├── composites/
│   ├── DataTable/
│   │   ├── DataTable.tsx
│   │   ├── DataTableToolbar.tsx
│   │   ├── ColumnDef.ts
│   │   ├── useDataTable.ts
│   │   └── index.ts
│   ├── FormWizard/
│   │   ├── FormWizard.tsx
│   │   ├── WizardStep.tsx
│   │   ├── useFormWizard.ts
│   │   └── index.ts
│   ├── Stepper/
│   │   ├── Stepper.tsx
│   │   ├── Step.tsx
│   │   └── index.ts
│   ├── Calendar/
│   │   ├── Calendar.tsx
│   │   ├── DatePicker.tsx
│   │   ├── DateRangePicker.tsx
│   │   └── index.ts
│   ├── CommandPalette/
│   │   ├── CommandPalette.tsx
│   │   ├── CommandGroup.tsx
│   │   ├── CommandItem.tsx
│   │   └── index.ts
│   └── Breadcrumb/
│       ├── Breadcrumb.tsx
│       ├── BreadcrumbItem.tsx
│       └── index.ts
├── patterns/
│   ├── PageShell/
│   │   ├── PageShell.tsx             # Public page layout
│   │   ├── PageHeader.tsx
│   │   ├── PageContent.tsx
│   │   ├── PageFooter.tsx
│   │   └── index.ts
│   ├── AdminShell/
│   │   ├── AdminShell.tsx            # Admin terminal layout
│   │   ├── AdminSidebar.tsx
│   │   ├── AdminHeader.tsx
│   │   ├── AdminContent.tsx
│   │   └── index.ts
│   ├── MobileShell/
│   │   ├── MobileShell.tsx           # QR ordering layout
│   │   ├── MobileHeader.tsx
│   │   ├── MobileBottomNav.tsx
│   │   └── index.ts
│   ├── LandingShell/
│   │   ├── LandingShell.tsx          # Marketing landing layout
│   │   ├── HeroSection.tsx
│   │   ├── FeatureSection.tsx
│   │   ├── CTASection.tsx
│   │   └── index.ts
│   ├── MenuShell/
│   │   ├── MenuShell.tsx             # Digital menu layout
│   │   ├── CategoryTabs.tsx
│   │   ├── ItemGrid.tsx
│   │   ├── CartSidebar.tsx
│   │   └── index.ts
│   └── CheckoutFlow/
│       ├── CheckoutFlow.tsx
│       ├── StepInfo.tsx
│       ├── StepPayment.tsx
│       ├── StepConfirm.tsx
│       └── index.ts
├── layouts/
│   ├── Container.tsx                 # Max-width wrapper
│   ├── Grid.tsx                      # Responsive grid
│   ├── Stack.tsx                     # Vertical/horizontal stack
│   ├── Section.tsx                   # Page section with scroll reveal
│   └── index.ts
├── hooks/
│   ├── useMedia.ts                   # Media query hook
│   ├── useReducedMotion.ts           # prefers-reduced-motion
│   ├── useScrollReveal.ts            # IntersectionObserver reveal
│   ├── useToast.ts                   # Toast hook (existing)
│   ├── useLocalStorage.ts            # Persisted state
│   ├── useDebounce.ts                # Debounced value
│   ├── useClickOutside.ts            # Outside click detection
│   ├── useKeyboard.ts                # Keyboard shortcuts
│   └── index.ts
└── utils/
    ├── cn.ts                         # className utility (clsx + tailwind-merge)
    ├── format.ts                     # Currency, date, number formatting
    ├── validation.ts                 # Zod schemas for forms
    └── index.ts
```

---

## 2.2 Primitive Component Specifications

### Button (from Stitch exports)
```typescript
// Variants (restyled for v6.1 Rustic Light: solid warm surfaces on light bg)
type ButtonVariant = 
  | 'primary'      // Forest green #4A7C59 fill, light text — main CTAs
  | 'bronze'       // Wood amber #C08A3E fill, dark text — "Order Now", "Checkout"
  | 'secondary'    // White card surface, chrome-mid border — secondary actions
  | 'ghost'        // Transparent, warm charcoal text — tertiary
  | 'danger'       // Error red, light text — destructive
  | 'outline';     // Chrome-mid border, transparent bg (page bg shows through)

// Sizes
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

// States: default, hover, active (scale 0.98), disabled, loading
// Features: icon left/right, full width, ripple effect
```

### Card (from `.glass-panel` Stitch pattern, restyled to v6.1 Rustic Light)
```typescript
// Base SOLID card — default is a solid warm surface (white or sunken beige),
// NOT glass. Glass blur is reserved for the sticky nav overlaying hero photos.
interface CardProps {
  variant?: 'default' | 'elevated' | 'outlined' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;        // Adds translateY(-2px) + shadow on hover
  interactive?: boolean;      // Adds active:scale-[0.98] + focus ring
  border?: 'default' | 'chrome' | 'forest' | 'error';
}

// Default: solid --aura-bg-card (#FFFFFF) on page bg, soft shadow
// Elevated: stronger shadow + border
// Outlined: border only, transparent bg
// Interactive: hover + active states for clickable cards
```

### Input (from Stitch checkout/form patterns)
```typescript
// Variants
type InputVariant = 
  | 'default'      // Sunken beige #EFEAE0 bg, chrome-mid border, muted-text placeholder
  | 'search'       // Inset, rounded-full, search icon
  | 'otp';         // Single char boxes for verification

// Features: label, helper text, error state, prefix/suffix icons,
// clear button, password toggle, auto-focus
```

### Chip (from Stitch filter chips)
```typescript
// Variants
type ChipVariant = 
  | 'filter'       // White card surface, chrome border → wood amber #C08A3E when active
  | 'action'       // Primary forest green / wood amber fill, clickable
  | 'label'        // Read-only status indicator
  | 'input';       // Removable chip in input (multi-select)

// Features: icon, dismissible, selected state, keyboard navigation
```

### Modal / Sheet (from Stitch modal patterns)
```typescript
// Modal: centered on dimmed scrim (rgba of warm charcoal), solid white card surface,
// scale+fade entrance. No glass blur by default.
// Sheet: bottom-anchored, drag handle, swipe to dismiss (mobile)
// Both: focus trap, escape to close, portal rendering
```

---

## 2.3 Migrate Existing Stitch Components

### Mapping Table
| Current Stitch Component | Target Aura Primitive | Migration Notes |
|-------------------------|----------------------|-----------------|
| `StitchButton` (all variants) | `Button` | Extract variants to cva |
| `glass-panel` CSS class | `Card` / `Surface` | Replace class with component |
| `chrome-border` CSS class | `FocusRing` utility | Replace with focus-visible ring |
| `bronze-glow` CSS class | `Button` variant='bronze' | Use variant prop |
| Scroll reveal inline script | `useScrollReveal` hook | Extract to reusable hook |
| `StitchHeader` / `SiteHeader` | `PageHeader` + `AdminHeader` | Split by shell type |
| `StitchFooter` | `PageFooter` | Simplify |
| `StitchAppLayout` | `PageShell` / `AdminShell` / `MobileShell` | Shell-specific layouts |
| Loyalty components | `Card` + `Badge` + `Progress` | Recompose |
| Menu card components | `Card` + `Chip` + `Badge` | Recompose |
| Admin table components | `DataTable` | Full replacement |
| KDS components | `Card` + `StatusBadge` + `Progress` | Recompose |

### Migration Strategy
1. **Create primitives first** — build Button, Card, Input, Chip, Badge, Modal, Sheet, Table, Tabs, Toast, Skeleton
2. **Build composites** — DataTable, FormWizard, Stepper, Calendar
3. **Build patterns** — PageShell, AdminShell, MobileShell, LandingShell, MenuShell, CheckoutFlow
4. **Migrate pages incrementally** — one route at a time, behind feature flag
5. **Delete old Stitch components** — after all consumers migrated

---

## 2.4 Enforce DESIGN.md Tokens via Stylelint

### Configuration
```json
// .stylelintrc.json
{
  "root": true,
  "customSyntax": "postcss-scss",
  "extends": ["stylelint-config-standard", "stylelint-config-tailwindcss"],
  "plugins": ["stylelint-no-unsupported-browser-features"],
  "rules": {
    "color-no-invalid-hex": true,
    "declaration-property-value-allowed-list": {
      "color": [
        "var(--aura-*)",
        "inherit",
        "currentColor",
        "transparent"
      ],
      "background-color": [
        "var(--aura-*)",
        "transparent",
        "inherit"
      ],
      "border-color": ["var(--aura-*)", "transparent"],
      "box-shadow": ["var(--aura-*)", "none"],
      "fill": ["var(--aura-*)", "currentColor"],
      "stroke": ["var(--aura-*)", "currentColor"]
    },
    "declaration-property-value-disallowed-list": {
      "color": ["/^#[0-9a-f]{3,8}$/i", "/^rgb/", "/^hsl/"],
      "background-color": ["/^#[0-9a-f]{3,8}$/i", "/^rgb/", "/^hsl/"],
      "border-color": ["/^#[0-9a-f]{3,8}$/i", "/^rgb/", "/^hsl/"],
      "box-shadow": ["/^rgba?/", "/^hsla?/"]
    },
    "font-family-no-missing-generic-family-keyword": true,
    "selector-class-pattern": "^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$"
  },
  "ignoreFiles": ["**/node_modules/**", "**/dist/**", "**/.next/**", "*.css"]
}
```

### Token Bridge (CSS vars → TypeScript)
```typescript
// src/components/aura/tokens/colors.ts
export const auraColors = {
  // Core surfaces
  bgPage: 'var(--aura-bg-page)',
  bgCard: 'var(--aura-bg-card)',
  bgSunken: 'var(--aura-bg-sunken)',
  surfaceRaised: 'var(--aura-surface-raised)',
  surfaceHover: 'var(--aura-surface-hover)',
  surfaceActive: 'var(--aura-surface-active)',
  surfaceOverlay: 'var(--aura-surface-overlay)',  // modal/drawer scrim = warm charcoal rgba(43,43,38,.45)

  // Brand
  primary: 'var(--aura-primary)',           // Forest Green #4A7C59
  secondary: 'var(--aura-secondary)',       // Container Blue #2E5E8C
  accentWarm: 'var(--aura-accent-warm)',    // Wood Amber #C08A3E

  // Chrome scale (neutral metallics)
  chromeLight: 'var(--aura-chrome-light)',
  chromeMid: 'var(--aura-chrome-mid)',

  // Text (warm charcoal on light)
  textPrimary: 'var(--aura-text-primary)',
  textMuted: 'var(--aura-text-muted)',
  textOnPrimary: 'var(--aura-text-on-primary)',
  textOnSecondary: 'var(--aura-text-on-secondary)',

  // Glass (DEMOTED — sticky nav over hero photos only, blur 8px)
  glassBg: 'var(--aura-glass-bg)',
  glassBlur: 'var(--aura-glass-blur)',
  glassBorder: 'var(--aura-glass-border)',

  // Status (light-mode adjusted)
  success: 'var(--aura-success)',
  successBg: 'var(--aura-success-bg)',
  warning: 'var(--aura-warning)',
  warningBg: 'var(--aura-warning-bg)',
  error: 'var(--aura-error)',
  errorBg: 'var(--aura-error-bg)',

  // Border
  borderSubtle: 'var(--aura-border-subtle)',
  borderStrong: 'var(--aura-border-strong)',
  borderFocus: 'var(--aura-border-focus)',
} as const;
```

### Migration Guard (transition allowlist)
- Any leftover `#00142c` (v6.0 dark-noir navy) hex value in existing stylesheets **must be flagged during migration**: add `/00142c/i` to `declaration-property-value-disallowed-list.color` as a temporary error-mode rule until the codebase is clean, then remove it (the blanket raw-hex ban above already covers new code).
- Scrims must use warm charcoal `rgba(43, 43, 38, x)` (`--aura-surface-overlay`) — never black or navy.

---

## 2.5 Storybook Setup

### Configuration
```typescript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/components/aura/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
    'storybook-addon-paddings',
    'storybook-viewport'
  ],
  framework: '@storybook/react-vite',
  docs: { autodocs: 'tag' },
  staticDirs: ['../public'],
  viteFinal: async (config) => {
    // Ensure Tailwind v4 + CSS vars work in Storybook
    return config;
  }
};

export default config;
```

### Required Stories per Primitive
| Component | Stories |
|-----------|---------|
| Button | All variants × sizes × states (loading, disabled) |
| Card | All variants × padding × interactive states |
| Input | All variants × with label/error/helper/icon |
| Chip | All variants × selected/dismissible |
| Badge | All status types × sizes |
| Modal/Sheet | Open/close animations, focus trap, nested |
| Table | Empty, loading, paginated, sortable, selectable |
| DataTable | Toolbar, filtering, sorting, pagination, row actions |
| PageShell/AdminShell/MobileShell | With/without header, sidebar states |

---

## 2.6 Acceptance Criteria

### Component Library
- [ ] 30+ primitives exported from `@/components/aura`
- [ ] All primitives have Storybook stories (100% coverage)
- [ ] All primitives have Vitest tests (happy path + edge cases)
- [ ] 0 Stylelint violations in aura package
- [ ] Bundle size impact < 50KB gzipped

### Migration
- [ ] Landing page rebuilt with `LandingShell` + primitives
- [ ] Digital menu rebuilt with `MenuShell` + primitives
- [ ] Checkout flow rebuilt with `CheckoutFlow` pattern
- [ ] Admin dashboard rebuilt with `AdminShell` + `DataTable`
- [ ] Mobile ordering rebuilt with `MobileShell` + primitives
- [ ] 0 references to old Stitch component files in migrated pages

### Design Token Enforcement
- [ ] Stylelint passes on full codebase
- [ ] No raw hex colors in aura components
- [ ] No hardcoded spacing values (use tokens)
- [ ] No hardcoded border radius (use tokens)

---

## File Ownership Matrix

| Sub-package | Files | Owner |
|-------------|-------|-------|
| `tokens/` | All token files | Design System |
| `primitives/Button`, `Input`, `Chip`, `Badge` | Core input/display | Frontend Core |
| `primitives/Card`, `Modal`, `Sheet`, `Dropdown` | Overlay/containers | Frontend Core |
| `primitives/Table`, `Tabs`, `Toast`, `Skeleton` | Data/feedback | Frontend Core |
| `composites/DataTable`, `FormWizard`, `Stepper` | Complex composites | Frontend Core |
| `patterns/PageShell`, `AdminShell`, `MobileShell`, `LandingShell`, `MenuShell`, `CheckoutFlow` | Page layouts | Feature Teams |
| `hooks/`, `utils/` | Shared utilities | Frontend Core |
| `stories/`, `tests/` | Documentation + tests | All (own their components) |

---

## Rollback Plan
- Feature flag `ENABLE_AURA_COMPONENTS` gates new library
- Old Stitch components remain until full migration
- Stylelint runs in warning mode first, then error mode

---

## Next Phase Dependency
Phase 3 (Page Consolidation) can start once primitives + PageShell/AdminShell are stable.