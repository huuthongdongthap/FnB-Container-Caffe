# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fnb-audit.spec.ts >> FnB UI — X100 Deep Audit >> Liên hệ (/contact.html) >> no emoji in body text content (content audit)
- Location: tests/playwright/fnb-audit.spec.ts:94:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic:
    - banner [ref=e2]:
      - generic [ref=e3]:
        - link "AURA CAFE AURA CAFE" [ref=e4] [cursor=pointer]:
          - /url: index.html
          - img "AURA CAFE" [ref=e5]
          - generic [ref=e6]: AURA CAFE
        - navigation "Navigation chính" [ref=e7]:
          - link "Trang Chủ" [ref=e8] [cursor=pointer]:
            - /url: index.html
          - link "Menu" [ref=e9] [cursor=pointer]:
            - /url: menu.html
          - link "Không Gian" [ref=e10] [cursor=pointer]:
            - /url: index.html#spaces
          - link "Đặt Bàn" [ref=e11] [cursor=pointer]:
            - /url: table-reservation.html
          - link "Loyalty" [ref=e12] [cursor=pointer]:
            - /url: loyalty.html
          - link "Khuyến Mãi" [ref=e13] [cursor=pointer]:
            - /url: promotions.html
          - link "Liên Hệ" [ref=e14] [cursor=pointer]:
            - /url: contact.html
        - generic [ref=e15]:
          - button "Chuyển chế độ sáng/tối" [ref=e16] [cursor=pointer]:
            - img [ref=e17]
          - link "Đặt Bàn" [ref=e19] [cursor=pointer]:
            - /url: table-reservation.html
    - dialog "Menu điều hướng" [ref=e20]:
      - link "Trang Chủ" [ref=e21] [cursor=pointer]:
        - /url: index.html
      - link "Menu" [ref=e22] [cursor=pointer]:
        - /url: menu.html
      - link "Không Gian" [ref=e23] [cursor=pointer]:
        - /url: index.html#spaces
      - link "Đặt Bàn" [ref=e24] [cursor=pointer]:
        - /url: table-reservation.html
      - link "Loyalty" [ref=e25] [cursor=pointer]:
        - /url: loyalty.html
      - link "Khuyến Mãi" [ref=e26] [cursor=pointer]:
        - /url: promotions.html
      - link "Liên Hệ" [ref=e27] [cursor=pointer]:
        - /url: contact.html
      - link "Theo Dõi Đơn" [ref=e28] [cursor=pointer]:
        - /url: track-order.html
      - link "About" [ref=e29] [cursor=pointer]:
        - /url: about-us.html
      - link "Đặt Bàn Ngay" [ref=e30] [cursor=pointer]:
        - /url: table-reservation.html
  - generic [ref=e31]:
    - generic [ref=e32]: LIÊN HỆ & GÓP Ý
    - heading "Kết Nối Với Chúng Tôi" [level=1] [ref=e33]
    - paragraph [ref=e34]: Mọi phản hồi đều giúp chúng tôi phục vụ bạn tốt hơn.
  - generic [ref=e35]:
    - generic [ref=e36]:
      - heading "Gửi Tin Nhắn" [level=2] [ref=e37]
      - paragraph [ref=e38]: Phản hồi của bạn rất quan trọng
      - generic [ref=e39]:
        - generic [ref=e40]:
          - generic [ref=e41]: Họ Và Tên *
          - textbox "Họ Và Tên *" [ref=e42]:
            - /placeholder: Nguyễn Văn A
        - generic [ref=e43]:
          - generic [ref=e44]: Email *
          - textbox "Email *" [ref=e45]:
            - /placeholder: email@example.com
        - generic [ref=e46]:
          - generic [ref=e47]: Số Điện Thoại *
          - textbox "Số Điện Thoại *" [ref=e48]:
            - /placeholder: 0946 013 633
        - generic [ref=e49]:
          - generic [ref=e50]: Loại Góp Ý
          - combobox "Loại Góp Ý" [ref=e51]:
            - option "Góp ý chất lượng dịch vụ" [selected]
            - option "Phản hồi về đồ uống/đồ ăn"
            - option "Góp ý về không gian"
            - option "Đặt bàn / Sự kiện"
            - option "Khiếu nại"
            - option "Khác"
        - generic [ref=e52]:
          - generic [ref=e53]: Nội Dung *
          - textbox "Nội Dung *" [ref=e54]:
            - /placeholder: Nhập nội dung góp ý hoặc khiếu nại...
        - generic [ref=e55]: Chúng tôi phản hồi trong vòng 24h
        - button "GỬI TIN NHẮN →" [ref=e56] [cursor=pointer]
    - generic [ref=e57]:
      - generic [ref=e58]:
        - generic [ref=e59]: 📍
        - generic [ref=e60]: Địa Chỉ
        - generic [ref=e61]: 27 Nguyễn Tất Thành
        - generic [ref=e62]: Phường Sa Đéc
        - generic [ref=e63]: Đồng Tháp, Việt Nam
        - link "Xem bản đồ →" [ref=e64] [cursor=pointer]:
          - /url: https://maps.google.com/?q=27+Nguyễn+Tất+Thành,+Sa+Đéc,+Đồng+Tháp
          - img [ref=e65]
          - text: Xem bản đồ →
      - generic [ref=e68]:
        - generic [ref=e69]: 📞
        - generic [ref=e70]: Hotline
        - link "0946 013 633" [ref=e72] [cursor=pointer]:
          - /url: tel:0946013633
        - generic [ref=e73]: "Thứ 2 — Thứ 6: 07:00 — 22:00 | Thứ 7 — Chủ Nhật: 06:00 — 23:00"
      - generic [ref=e74]:
        - generic [ref=e75]: Theo Dõi Chúng Tôi
        - generic [ref=e76]:
          - link "Facebook" [ref=e77] [cursor=pointer]:
            - /url: https://facebook.com/auraspaces
          - link "Instagram" [ref=e78] [cursor=pointer]:
            - /url: https://instagram.com/auraspaces
          - link "TikTok" [ref=e79] [cursor=pointer]:
            - /url: https://tiktok.com/@auraspaces
      - generic [ref=e80]:
        - generic [ref=e81]: Giờ Mở Cửa
        - generic [ref=e82]: "Thứ 2 — Thứ 6: 07:00 — 22:00"
        - generic [ref=e83]: "Thứ 7 — Chủ Nhật: 06:00 — 23:00"
        - generic [ref=e85]: 🟢 Đang mở cửa
  - generic [ref=e86]: ✓ Cảm ơn! Tin nhắn của bạn đã được gửi.
  - contentinfo [ref=e88]:
    - generic [ref=e89]:
      - generic [ref=e90]:
        - generic [ref=e91]:
          - img "AURA CAFE" [ref=e92]
          - text: AURA CAFE
        - paragraph [ref=e93]: Where Flavor Meets Design
        - generic [ref=e94]:
          - link "Theo dõi AURA CAFE trên Facebook" [ref=e95] [cursor=pointer]:
            - /url: https://facebook.com/auracafesadec
            - img [ref=e96]
          - link "Theo dõi AURA CAFE trên Instagram" [ref=e98] [cursor=pointer]:
            - /url: https://instagram.com/auracafesadec
            - img [ref=e99]
          - link "Theo dõi AURA CAFE trên TikTok" [ref=e102] [cursor=pointer]:
            - /url: https://tiktok.com/@auracafesadec
            - img [ref=e103]
          - link "Liên hệ AURA CAFE qua Zalo" [ref=e105] [cursor=pointer]:
            - /url: https://zalo.me/0946013633
            - img [ref=e106]
      - generic [ref=e109]:
        - heading "Khám Phá" [level=5] [ref=e110]
        - link "Menu" [ref=e111] [cursor=pointer]:
          - /url: menu.html
        - link "Không Gian" [ref=e112] [cursor=pointer]:
          - /url: index.html#spaces
        - link "Đặt Bàn" [ref=e113] [cursor=pointer]:
          - /url: table-reservation.html
      - generic [ref=e114]:
        - heading "Thành Viên" [level=5] [ref=e115]
        - link "Loyalty & Cashback" [ref=e116] [cursor=pointer]:
          - /url: loyalty.html
        - link "Theo Dõi Đơn" [ref=e117] [cursor=pointer]:
          - /url: track-order.html
      - generic [ref=e118]:
        - heading "Hỗ Trợ & Admin" [level=5] [ref=e119]
        - link "Liên Hệ" [ref=e120] [cursor=pointer]:
          - /url: contact.html
        - link "About" [ref=e121] [cursor=pointer]:
          - /url: about-us.html
        - link "Admin Dashboard" [ref=e122] [cursor=pointer]:
          - /url: /admin/dashboard.html
        - link "KDS" [ref=e123] [cursor=pointer]:
          - /url: kds.html
    - generic [ref=e124]: © 2026 AURA CAFE · Sa Đéc, Đồng Tháp · fnbcontainer.vn v2.1.0
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const PAGES = [
  4   |   { name: 'index', url: '/', label: 'Trang chủ' },
  5   |   { name: 'menu', url: '/menu.html', label: 'Thực đơn' },
  6   |   { name: 'checkout', url: '/checkout.html', label: 'Thanh toán' },
  7   |   { name: 'loyalty', url: '/loyalty.html', label: 'Tích điểm' },
  8   |   { name: 'reservation', url: '/table-reservation.html', label: 'Đặt bàn' },
  9   |   { name: 'contact', url: '/contact.html', label: 'Liên hệ' },
  10  |   { name: 'about', url: '/about-us.html', label: 'Giới thiệu' },
  11  | ];
  12  | 
  13  | const BANNED_HEX = [
  14  |   '#FFD700', '#D4AF37', '#B8860B', '#FFE970',
  15  |   '#FF6B35', '#FF1744', '#8B4513', '#C9A200', '#C9A962',
  16  | ];
  17  | 
  18  | test.describe('FnB UI — X100 Deep Audit', () => {
  19  |   test.beforeEach(async ({ page }) => {
  20  |     await page.goto('/');
  21  |   });
  22  | 
  23  |   for (const p of PAGES) {
  24  |     test.describe(`${p.label} (${p.url})`, () => {
  25  |       test.beforeEach(async ({ page }) => {
  26  |         await page.goto(p.url);
  27  |         await page.waitForLoadState('networkidle');
  28  |       });
  29  | 
  30  |       test('page loads without console errors', async ({ page }) => {
  31  |         const errors: string[] = [];
  32  |         page.on('pageerror', err => errors.push(err.message));
  33  |         page.on('console', msg => {
  34  |           if (msg.type() === 'error') errors.push(msg.text());
  35  |         });
  36  |         await page.reload();
  37  |         await page.waitForLoadState('networkidle');
  38  |         await expect(errors).toEqual([]);
  39  |       });
  40  | 
  41  |       test('no FOVT — theme applied before paint', async ({ page }) => {
  42  |         const themeSnap = await page.evaluate(() => {
  43  |           const html = document.documentElement;
  44  |           return {
  45  |             theme: html.getAttribute('data-theme'),
  46  |             computedBg: getComputedStyle(html).backgroundColor,
  47  |           };
  48  |         });
  49  |         expect(['light', 'dark']).toContain(themeSnap.theme);
  50  |       });
  51  | 
  52  |       test('no banned Fire/Earth color hex in computed styles', async ({ page }) => {
  53  |         const banned = await page.evaluate((bannedList) => {
  54  |           const all = document.querySelectorAll('*');
  55  |           const found: string[] = [];
  56  |           for (const el of all) {
  57  |             const bg = getComputedStyle(el).backgroundColor;
  58  |             const color = getComputedStyle(el).color;
  59  |             for (const hex of bannedList) {
  60  |               if (bg.includes(hex) || color.includes(hex)) {
  61  |                 found.push(`${el.tagName}.${el.className} — ${hex}`);
  62  |               }
  63  |             }
  64  |           }
  65  |           return [...new Set(found)];
  66  |         }, BANNED_HEX);
  67  |         expect(banned).toEqual([]);
  68  |       });
  69  | 
  70  |       test('no horizontal overflow on mobile (375px)', async ({ page }) => {
  71  |         await page.setViewportSize({ width: 375, height: 667 });
  72  |         await page.reload();
  73  |         await page.waitForLoadState('networkidle');
  74  |         const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  75  |         expect(overflow).toBe(0);
  76  |       });
  77  | 
  78  |       test('no horizontal overflow on tablet (768px)', async ({ page }) => {
  79  |         await page.setViewportSize({ width: 768, height: 1024 });
  80  |         await page.reload();
  81  |         await page.waitForLoadState('networkidle');
  82  |         const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  83  |         expect(overflow).toBe(0);
  84  |       });
  85  | 
  86  |       test('no horizontal overflow on desktop (1440px)', async ({ page }) => {
  87  |         await page.setViewportSize({ width: 1440, height: 900 });
  88  |         await page.reload();
  89  |         await page.waitForLoadState('networkidle');
  90  |         const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  91  |         expect(overflow).toBe(0);
  92  |       });
  93  | 
  94  |       test('no emoji in body text content (content audit)', async ({ page }) => {
  95  |         const hasEmoji = await page.evaluate(() => {
  96  |           const bodyText = document.body.innerText;
  97  |           return /[\u{1F300}-\u{1FAFF}]/u.test(bodyText);
  98  |         });
> 99  |         expect(hasEmoji).toBe(false);
      |                          ^ Error: expect(received).toBe(expected) // Object.is equality
  100 |       });
  101 | 
  102 |       test('hero/critical section visible and not zero-size', async ({ page }) => {
  103 |         const hero = page.locator('.hero, .hero-v8, #hero');
  104 |         if (await hero.count() > 0) {
  105 |           const box = await hero.first().boundingBox();
  106 |           expect(box?.width).toBeGreaterThan(0);
  107 |           expect(box?.height).toBeGreaterThan(0);
  108 |         }
  109 |       });
  110 | 
  111 |       test('nav links are clickable and responsive', async ({ page }) => {
  112 |         const nav = page.locator('nav, .navbar, #shared-navbar');
  113 |         if (await nav.count() > 0) {
  114 |           const links = nav.first().locator('a');
  115 |           const count = await links.count();
  116 |           expect(count).toBeGreaterThan(0);
  117 |           for (let i = 0; i < Math.min(count, 5); i++) {
  118 |             await links.nth(i).click();
  119 |             await page.waitForLoadState('networkidle');
  120 |             expect(page.url()).not.toBe('about:blank');
  121 |           }
  122 |         }
  123 |       });
  124 |     });
  125 |   }
  126 | 
  127 |   test.describe('Cross-page consistency', () => {
  128 |     test('brand-tokens.css loads on all pages', async ({ page }) => {
  129 |       for (const p of PAGES) {
  130 |         await page.goto(p.url);
  131 |         const link = page.locator('link[href*="brand-tokens.css"]');
  132 |         await expect(link).toHaveCount(1, { timeout: 5000 });
  133 |       }
  134 |     });
  135 | 
  136 |     test('shared-nav.js loads on all pages', async ({ page }) => {
  137 |       for (const p of PAGES) {
  138 |         await page.goto(p.url);
  139 |         const script = page.locator('script[src*="shared-nav"]');
  140 |         if (await script.count() > 0) {
  141 |           await expect(script.first()).toBeAttached();
  142 |         }
  143 |       }
  144 |     });
  145 | 
  146 |     test('no 404s on page assets', async ({ page }) => {
  147 |       const failed: string[] = [];
  148 |       page.on('response', async (res) => {
  149 |         if (res.status() === 404) {
  150 |           failed.push(res.url());
  151 |         }
  152 |       });
  153 |       for (const p of PAGES) {
  154 |         await page.goto(p.url);
  155 |         await page.waitForLoadState('networkidle');
  156 |       }
  157 |       expect(failed).toEqual([]);
  158 |     });
  159 |   });
  160 | });
  161 | 
```