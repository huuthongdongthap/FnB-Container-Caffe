---
phase: 3
title: "JavaScript Performance"
status: pending
priority: P2
dependencies: [1]
effort: "0.5-1h"
---

# Phase 3: JavaScript Performance

## Overview

Audit and standardize debounce usage. Red-team verified: `debounce` already
imported by 4 files (shared-nav.js, hero-aura.js, ui-animations.js, script.js).
Most scroll handlers already debounced. This phase is now an AUDIT + targeted
cleanup, not a full implementation.

## TDD Structure

1. **Capture baseline**: Profile scroll performance on sample pages (DevTools Performance tab). Record current listener patterns.
2. **Audit**: Catalog all scroll/mousemove listeners. Mark already-debounced vs raw.
3. **Fix**: Standardize imports to `utils.js`. Only wrap raw scroll listeners (not mousemove parallax).
4. **Verify**: Profile again. No jank regression.

## Issue to Fix

### #13 (RESCOPED): Standardize debounce imports + wrap remaining raw scroll listeners

Red-team verified state:
- ✅ `shared-nav.js:9` — imports `debounce` from utils.js; scroll listener at line 434 already uses `debouncedScroll`
- ✅ `hero-aura.js:11` — imports `debounce` from utils.js
- ✅ `ui-animations.js:6` — imports `debounce` from utils.js; scroll listener at line 164 already debounced
- ✅ `script.js:10` — imports `debounce` from utils.js; scroll listener at line 369 already debounced
- ✅ `wow-engine.js:8` — has local `debounce()`; scroll listeners at lines 30,107,193 already debounced with rAF
- ✅ `main.js:3` — has local `debounce()`; scroll listener at line 46 already debounced
- ⚠️ `hero-aura.js:190` — raw `mousemove` listener (parallax — do NOT debounce, use rAF throttle)
- ⚠️ `wow-engine.js:45,72` — raw `mousemove` listeners (animation-driven — do NOT debounce)

**Actual work remaining:**
1. Standardize `main.js` and `wow-engine.js` local `debounce()` copies to import from `utils.js`
2. Wrap mousemove parallax/tilt handlers with `requestAnimationFrame` throttle (not debounce)

## Related Code Files

- **Modify**: `js/main.js` (standardize import), `js/wow-engine.js` (standardize import + rAF)
- **Modify**: `js/hero-aura.js:190` (rAF throttle on mousemove)
- **Reference**: `js/utils.js` (canonical debounce source)

## Implementation Steps

1. **Audit**: Grep for `function debounce` and `addEventListener.*(scroll|mousemove)` → confirm findings above
2. **Standardize**: Replace local `debounce()` in main.js and wow-engine.js with `import { debounce } from './utils.js'`
3. **rAF throttle**: Add `requestAnimationFrame` throttle to mousemove parallax handlers (hero-aura.js:190, wow-engine.js:45,72)
4. **Verify**: `npm test` passes. Manual scroll → smooth animations, no jank.

## Success Criteria

- [ ] All scroll listeners use debounce from utils.js (no local copies except animation-specific)
- [ ] Mousemove parallax handlers use rAF throttle (NOT debounce — preserves smoothness)
- [ ] No NEW `npm test` failures beyond 60 baseline
- [ ] `npm run build` passes

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Debounce on animation mousemove causes jank | Explicitly excluded — use rAF throttle instead |
| Import standardization breaks non-module scripts | Check `<script type="module">` vs `<script>` on affected pages |
