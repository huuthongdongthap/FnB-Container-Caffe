---
phase: 3
title: "Accessibility Fixes"
status: completed
priority: P1
dependencies: []
---

# Phase 3: Accessibility Fixes

## Overview

Address WCAG compliance gaps in Stitch components. 3 independent sub-tasks run in parallel.

## Requirements

- **Functional:** Focus traps on 3 mobile navigation drawers
- **Functional:** Skip-to-content link at top of StitchAppLayout
- **Functional:** Touch targets ≥ 44px on all quantity increment/decrement buttons
- **Non-functional:** Focus trap closes on Escape key press
- **Non-functional:** Skip link becomes visible on Tab (first focusable element)

## Related Code Files

- Modify: `src/components/stitch/StitchHeader.tsx` — mobile drawer focus trap
- Modify: `src/components/stitch/StitchKDSNew.tsx` — sidebar focus trap
- Modify: `src/components/stitch/StitchAdminTerminalNew.tsx` — sidebar focus trap
- Modify: `src/components/stitch/StitchAppLayout.tsx` — skip-to-content link
- Modify: `src/components/stitch/StitchMobileOrderNew.tsx` — touch targets
- Modify: `src/components/stitch/StitchPOSNew.tsx` — touch targets

## Sub-task 3a: Focus Traps

### StitchHeader mobile drawer
- Detect mobile drawer open state (menu toggle)
- When open: trap keyboard focus within the drawer
- Close on Escape key press
- Focus back to hamburger button on close

### StitchKDSNew mobile sidebar
- Same pattern for sidebar navigation

### StitchAdminTerminalNew mobile sidebar
- Same pattern for admin sidebar

Implementation pattern for each:
```tsx
import { useEffect, useRef } from 'react';

// In drawer open effect:
useEffect(() => {
  if (!isOpen) return;
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { close(); return; }
    // Focus trap logic
    const focusable = drawerRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) return;
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener('keydown', handleKeyDown);
  // Focus first element
  requestAnimationFrame(() => { drawerRef.current?.querySelector('button')?.focus(); });
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [isOpen, close]);
```

## Sub-task 3b: Skip-to-Content Link

Add at top of StitchAppLayout.tsx, before `<Routes>`:
```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--aura-primary)] focus:text-[var(--aura-on-primary)] focus:rounded focus:outline-none"
>
  {t('common.skipToContent')}
</a>
```

Add `id="main-content"` to the `<main>` wrapper or route container within StitchAppLayout.

## Sub-task 3c: Touch Targets ≥ 44px

### StitchMobileOrderNew
Replace:
```tsx
className="w-7 h-7"   // 28px — FAILS WCAG 2.5.8
```
With:
```tsx
className="min-w-[44px] min-h-[44px] flex items-center justify-center"
```

### StitchPOSNew
Same fix for quantity add/remove buttons:
```tsx
className="w-7 h-7" → "min-w-[44px] min-h-[44px] flex items-center justify-center"
className="w-8 h-8" → "min-w-[44px] min-h-[44px] flex items-center justify-center"
```

Also fix cart toggle button icon-only:
```tsx
// Ensure total clickable area ≥ 44px
className="min-w-[44px] min-h-[44px] flex items-center justify-center ..."
```

## Success Criteria

- [ ] StitchHeader mobile drawer: focus trapped, Escape closes, return focus on close
- [ ] StitchKDSNew sidebar: focus trapped, Escape closes
- [ ] StitchAdminTerminalNew sidebar: focus trapped, Escape closes
- [ ] Skip-to-content link renders first in tab order, visible on focus
- [ ] Skip-to-content link navigates to `#main-content`
- [ ] Quantity buttons in StitchMobileOrderNew ≥ 44px
- [ ] Quantity buttons in StitchPOSNew ≥ 44px
- [ ] Cart toggle button in StitchPOSNew ≥ 44px
- [ ] Build passes with 0 errors
