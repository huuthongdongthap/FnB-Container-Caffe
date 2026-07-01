---
phase: 1
title: "Foundation: Design System + React Setup"
status: pending
priority: P1
dependencies: []
effort: "10h"
---

# Phase 1: Foundation — Design System + React Setup

## Overview

Generate the Navy+Warm hybrid design system via ui-ux-pro-max, add React + TypeScript to the existing Vite project, build shared UI components, and establish testing infrastructure. This is the sequential prerequisite for all other phases.

**Red-team corrections:** Vite already exists — add React, don't reinitialize. search.py path is absolute to skill directory. Font stack: Cormorant Garamond + Space Grotesk + Plus Jakarta Sans (preserve Bazi v5.1 migration).

## Requirements

- Functional: Design system tokens in CSS custom properties, React + TypeScript added to existing Vite project, core UI components (Button, Card, Input, Badge, Modal, Skeleton, Navbar, Footer, Drawer), Vitest + Testing Library + Playwright setup
- Non-functional: Build < 1s, HMR < 100ms, design tokens map 1:1 to Tailwind config, TypeScript strict mode

## Architecture

```
FnB-Container-Caffe/
├── design-system/
│   ├── MASTER.md                    # ui-ux-pro-max --persist output
│   └── tokens/
│       ├── colors.css               # Navy + Warm accent CSS vars
│       ├── typography.css           # Cormorant Garamond + Space Grotesk + Plus Jakarta Sans
│       ├── spacing.css              # 4px scale
│       └── effects.css              # Shadows, glass, transitions
├── src/
│   ├── components/
│   │   └── ui/                      # Button, Card, Input, Badge, Modal, Skeleton, Navbar, Footer, Drawer
│   ├── lib/                         # API client, cn() utility
│   ├── hooks/                       # useAuth, useCart, useMenu (TanStack Query)
│   └── styles/
│       ├── global.css               # brand-tokens import + Tailwind directives
│       └── fonts.css                # @font-face rules (local woff2 files)
├── vite.config.js                   # MODIFY: add React plugin, preserve multi-page config
├── tsconfig.json                    # NEW
├── package.json                     # MODIFY: add deps, preserve existing scripts
└── vitest.config.ts                 # NEW
```

## TDD: Tests to Write First

1. `src/components/ui/__tests__/button.test.tsx` — renders variants, handles click, disabled, loading
2. `src/components/ui/__tests__/card.test.tsx` — renders children, className, header/footer slots
3. `src/components/ui/__tests__/input.test.tsx` — label, error state, onChange, aria-required
4. `src/components/ui/__tests__/modal.test.tsx` — opens/closes, focus trap, Escape close, overlay
5. `src/components/ui/__tests__/navbar.test.tsx` — nav links, mobile drawer toggle, active link
6. `src/lib/__tests__/cn.test.ts` — merges Tailwind classes, handles conflicts/undefined/null
7. `design-system/__tests__/tokens.test.ts` — CSS vars defined, no forbidden colors, contrast ≥ 4.5:1

## Implementation Steps

### 1.1 Generate Design System
- Run from FnB project root:
  `python3 /Users/macbook/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py "food beverage cafe container coffee shop" --design-system --persist -p "FnB Container Caffe" --output-dir design-system/`
- Review generated MASTER.md, adjust palette to Navy+Warm hybrid
- Extract CSS custom properties to `design-system/tokens/`
- **Font stack:** Cormorant Garamond (display) + Space Grotesk (body) + Plus Jakarta Sans (utility). Do NOT use Playfair Display SC or Karla — project already migrated away from Playfair Display.

### 1.2 Add React + TypeScript to Existing Vite Project
- DO NOT run `npm create vite@latest` — Vite v8.0.3 already configured with multi-page HTML build, `_redirects` handling, and exclusion list
- Install: `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, `@types/react`, `@types/react-dom`, `typescript`, `clsx`, `lucide-react`
- Install dev: `@vitejs/plugin-react`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `happy-dom`, `playwright`, `@playwright/test`
- Add `@vitejs/plugin-react` to existing `vite.config.js` (merge, don't replace)
- Run `tsc --init` with strict mode
- Preserve existing scripts: `"lint"`, `"minify"`, `"dev"`, `"build"`, `"test"`

### 1.3 Build Core UI Components
- Button (variants: primary/secondary/ghost/destructive, sizes, loading state)
- Card (header, body, footer slots)
- Input (label, error, helper text)
- Badge (status colors)
- Modal (overlay, focus trap, Escape close)
- Skeleton (text, circular, rectangular)
- Navbar (nav links, mobile drawer, theme toggle)
- Footer (5-zone showcase, social links, hours)
- Drawer (slide from right, overlay)

### 1.4 Set Up Testing Infrastructure
- Vitest config with jsdom environment
- Setup file with `@testing-library/jest-dom` matchers
- Test utilities: custom render with providers (Router, QueryClient)
- Playwright config for E2E tests
- CI: `npm test` runs unit tests, `npm run test:e2e` runs Playwright

### 1.5 Configure Routing + Data Layer
- React Router route tree matching existing URL structure
- TanStack Query client with Cloudflare Worker base URL
- API client utility with typed fetch wrapper
- File allocation registry to prevent parallel phase collisions on `src/pages/`, `src/components/`, `src/hooks/`

## Success Criteria

- [ ] All 7 TDD test files written and passing
- [ ] `npm run build` exits 0 (Vite with React plugin)
- [ ] `npm run dev` serves React app on :5173 with HMR
- [ ] Design system MASTER.md generated with Navy+Warm palette + Cormorant Garamond font stack
- [ ] All 9 core UI components render on test page
- [ ] Tailwind theme tokens match design-system/tokens/ exactly
- [ ] TypeScript strict: 0 errors, 0 `:any` types
- [ ] Existing scripts preserved (lint, minify, dev, build, test)
- [ ] File allocation registry in place for parallel phase coordination

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Vite plugin conflict (React vs existing multi-page) | Test build before committing; keep multi-page config as fallback |
| Design token mismatch with Bazi legacy | Run contrast audit before finalizing tokens |
| React files collide with existing HTML during dev | Work in `src/` subdirectory; old files untouched |
| search.py path differs per machine | Document absolute path; add symlink fallback |
