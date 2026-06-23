# ADR 003: Static HTML + Vanilla JS Over React/Vue SPA

**Date:** 2026-03-10  
**Status:** Accepted  
**Decision Maker:** Founder / Lead Developer

## Context

We needed a frontend architecture for:
- Fast initial load (critical for customer conversion)
- Simple deployment (static assets on Pages)
- Low maintenance (small team, no complex build)
- SEO-friendly (all pages indexable)

Alternatives:
1. **Static HTML + Vanilla JS** (current): Direct, no framework overhead
2. **React + Vite**: Component-based, but build step needed
3. **Vue.js**: Similar to React, lighter weight
4. **Svelte**: Compile-time framework, smaller bundles

## Decision

Chose **Static HTML + Vanilla JS** with Vite for asset bundling.

## Consequences

### Positive
- ✅ **Fastest possible load**: No framework JS to download/parse
- ✅ **Simple debugging**: View Source shows actual HTML, no virtual DOM
- ✅ **SEO perfect**: Search bots see complete HTML
- ✅ **No build complexity**: Vite handles CSS/JS minification only
- ✅ **Easy to onboard**: Any developer can read/edit HTML/JS
- ✅ **No runtime framework errors**: Framework bugs eliminated

### Negative
- ⚠️ **Manual DOM updates**: More verbose code for dynamic UI
- ⚠️ **No component reuse**: Duplicate code across pages (though shared in `js/` modules)
- ⚠️ **No virtual DOM diffing**: Must manually update UI state
- ⚠️ **No JSX/TSX**: No compile-time type checking (but ESLint helps)

### Risks
- **Code duplication**: Without components, risk of copy-paste code — mitigated by shared JS modules in `/js/`
- **State management complexity**: Vanilla JS requires careful state sync — mitigated by `config.js` and `main.js` centralization
- **Scalability**: Adding complex interactive features may become harder — acceptable for our use case (forms, tables, cart)

## Alternatives Considered (Rejected)

- **React**: Too heavy for our needs (35+ pages would need routing, SSR for SEO). Bundle size ~100KB minified vs our current ~30KB total.
- **Vue**: Similar concerns to React; would require Vue Router, Vuex — added complexity
- **Svelte**: Would need compile step, team unfamiliarity

## Why This Works for Us

Our frontend needs are mostly:
- Forms (login, checkout, reservation)
- Tables (admin order list, KDS)
- Modals (payment QR, confirmations)
- Real-time polling (KDS, order status)

All achievable with vanilla JS + `fetch()` + `localStorage`. No complex client-side routing needed (each page is separate HTML).

## Future Re-evaluation

If we add:
- Real-time collaboration features → Consider WebSocket + framework
- Complex dashboard with charts → Could add lightweight chart library (Chart.js)
- Mobile app → Might need React Native or Flutter wrapper

At that point, we can incrementally adopt frameworks on new pages only.

## Related

- HTML pages: root `*.html`, `admin/*.html`
- JavaScript modules: `/js/`
- Vite config: `vite.config.js`
- See `03_ARCHITECTURE.md` section "Frontend Architecture"
