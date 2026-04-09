# Task: AURA SPACE — Premium Web UI Upgrade

## Context
- Codebase: `/Users/mac/mekong-cli/FnB-Container-Caffe/`
- Stack: Vanilla HTML/CSS/JS, Cloudflare Pages, M3 Design Tokens
- Files created by CTO (already exist): `css/premium-upgrade.css`, `js/premium-ui.js`
- Already wired into: index.html, menu.html, checkout.html, success.html, failure.html, about-us.html, loyalty.html

## Tasks to Execute

### 1. Verify CSS/JS injection
Check all 7 HTML files have `premium-upgrade.css` and `premium-ui.js` properly linked.

### 2. Polish success.html PayOS page
- Add gradient background matching brand (#0A0A0A → #111)
- Add animated checkmark SVG
- Add "Đơn hàng đã thanh toán thành công" with gold gradient text
- Add "Quay về trang chủ" CTA button with brand styling
- Use Cormorant Garamond for headers, Space Grotesk for body

### 3. Polish failure.html PayOS page  
- Red accent error state
- Retry payment button
- Contact support link
- "Thanh toán thất bại" header

### 4. Add lazy loading to images
In index.html, menu.html — add `loading="lazy"` to all `<img>` tags below the fold.

### 5. Wire premium CSS/JS into remaining pages
Check: kds.html, kitchen-display.html, table-reservation.html, contact.html, track-order.html
If missing premium-upgrade.css or premium-ui.js, add them.

### 6. Test locally
Run `npx serve .` and verify:
- Dark mode navbar glassmorphism on scroll
- Hero entrance animations
- Card hover lift effects
- Stat counter animations

## Design Tokens Reference
- Background: #0A0A0A (dark), #FFFBFE (light)  
- Gold: #C9A962, #FFD700
- Fonts: Cormorant Garamond (display), Space Grotesk (title/label), Inter (body)
- Glass: rgba(10,10,10,0.6) + blur(16px)
- Glow: 0 0 20px rgba(201,169,98,0.5)
