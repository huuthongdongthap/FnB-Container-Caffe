# Original User Request

## Initial Request — 2026-06-01T16:22:04+07:00

Fix two critical bugs in the AURA SPACE café web app that prevent customers from browsing the menu and placing orders. This is a **production bug fix** for a site launching 6/6/2026.

Working directory: /Users/mac/mekong-cli/FnB-Container-Caffe
Integrity mode: development

## Bug Analysis

### Bug 1: Menu page is empty
**Root cause**: `js/menu.js` calls `ApiService.getCategories()` and `ApiService.getProducts()` from a Cloudflare Worker API. When data returns, it tries to render into `[data-category]` DOM elements via `renderMenuCategories()` (line 113-129). But `menu.html` has NO `data-category` sections — only an empty `<div class="menu-grid" id="menuGrid"></div>` at line 241. The JS creates transformed data but has nowhere to render it.

**The API works** — `https://aura-space-worker.sadec-marketing-hub.workers.dev/api/menu` returns 75 products across categories: hot-coffee, iced-coffee, frappuccino, smoothies, juice, other-drinks, signature, snacks.

### Bug 2: Order flow breaks between menu → checkout
**Root cause**: `menu.js` saves cart to localStorage as `aura_cart` with format `{items: [...], total, count}`. But `checkout.js` line 144 tries keys `aura_cart_v1`, `aura_cart` (legacy), and `cart` (legacy) and expects different formats. The cart data may not transfer correctly between the menu page and checkout page.

## Requirements

### R1. Menu Page Must Display All Products
When a user visits `menu.html`, all available menu items from the API must render in the grid. If the API is unreachable, a static fallback menu (matching the real menu items) must display instead. The menu must show item name, price, and an "add to cart" button.

### R2. Order Flow Must Work End-to-End
A user must be able to: browse menu → add items to cart → see cart count update → click checkout → arrive at `checkout.html` with their cart items displayed → select payment method → complete order. The cart data must persist correctly between `menu.html` and `checkout.html` via localStorage.

### R3. No Regressions
All existing 557 tests must continue to pass. The build must succeed with 0 errors. The homepage (`index.html`) order modal must still work independently.

## Technical Context

- `js/menu.js`: Menu page JS — loads from API, renders cards, manages cart
- `js/script.js`: Homepage JS — has static `MENU_ITEMS` for the order modal
- `js/checkout.js`: Checkout page — reads cart from localStorage
- `js/api-client.js`: API client — `ApiService.getCategories()`, `ApiService.getProducts()`
- `js/config.js`: API base URL config
- `menu.html`: Menu page HTML — currently has empty `#menuGrid` div
- `checkout.html`: Checkout page
- Worker API: `https://aura-space-worker.sadec-marketing-hub.workers.dev/api/menu` (live, returns 75 products)

The API response format for /api/menu is an array of objects with: id, category, name, price, description, tags, badge, available.
Categories from /api/categories: [{id: 'cat-001', name: 'Cà Phê', ...}, ...]

## Acceptance Criteria

### Menu Display
- [ ] `menu.html` renders menu items (not empty) when loaded in a browser
- [ ] Menu items show name and price
- [ ] Each item has a working "add to cart" button
- [ ] If API fails, a static fallback menu displays

### Order Flow
- [ ] Adding items on `menu.html` updates the cart badge count
- [ ] Navigating to `checkout.html` shows the cart items that were added
- [ ] Cart data in localStorage is consistent between menu.js and checkout.js

### Build & Tests
- [ ] `npm run build` completes with 0 errors
- [ ] `npm test` passes 557+ tests with 0 failures
- [ ] No new console errors in production code
