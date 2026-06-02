# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fnb-audit.spec.ts >> FnB UI — X100 Deep Audit >> Đặt bàn (/table-reservation.html) >> page loads without console errors
- Location: tests/playwright/fnb-audit.spec.ts:30:7

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "Failed to load resource: net::ERR_CONNECTION_REFUSED",
+ ]
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
  - banner [ref=e31]:
    - heading "Đặt Bàn Trực Tuyến" [level=1] [ref=e32]
    - generic [ref=e33]: Real-time
  - generic [ref=e34]:
    - generic [ref=e35]:
      - generic [ref=e36]:
        - generic [ref=e37]: Ngày & Số Khách
        - generic [ref=e38]:
          - textbox [ref=e39]: 2026-06-06
          - combobox [ref=e40]:
            - option "1 người"
            - option "2 người" [selected]
            - option "3 người"
            - option "4 người"
            - option "5 người"
            - option "6 người"
            - option "7 người"
            - option "8 người"
            - option "9 người"
            - option "10 người"
      - generic [ref=e41]:
        - generic [ref=e42]: Khung Giờ
        - generic [ref=e43]:
          - button "07:00" [ref=e44] [cursor=pointer]
          - button "08:00" [ref=e45] [cursor=pointer]
          - button "09:00" [ref=e46] [cursor=pointer]
          - button "10:00" [ref=e47] [cursor=pointer]
          - button "11:00" [ref=e48] [cursor=pointer]
          - button "14:00" [ref=e49] [cursor=pointer]
          - button "15:00" [ref=e50] [cursor=pointer]
          - button "16:00" [ref=e51] [cursor=pointer]
          - button "17:00" [ref=e52] [cursor=pointer]
          - button "19:00" [ref=e53] [cursor=pointer]
          - button "20:00" [ref=e54] [cursor=pointer]
          - button "21:00" [ref=e55] [cursor=pointer]
      - generic [ref=e56]:
        - generic [ref=e57]: Khu Vực
        - generic [ref=e58]:
          - button "Rooftop" [ref=e59] [cursor=pointer]
          - button "Café Bar" [ref=e60] [cursor=pointer]
          - button "Sân Trống" [ref=e61] [cursor=pointer]
    - generic [ref=e62]:
      - generic [ref=e63]:
        - heading "Mặt Bằng Rooftop" [level=2] [ref=e64]
        - generic [ref=e65]:
          - generic [ref=e66]: Trống
          - generic [ref=e68]: Đang chọn
          - generic [ref=e70]: Đã đặt
      - generic [ref=e73]:
        - generic [ref=e74]: R O O F T O P D E C K
        - generic [ref=e75]: Bar / Quầy pha chế
        - generic [ref=e76]: Hàng 1
        - generic [ref=e77]:
          - button "#B01" [ref=e78] [cursor=pointer]:
            - generic [ref=e79]: "#B01"
          - button "#B02" [ref=e80] [cursor=pointer]:
            - generic [ref=e81]: "#B02"
          - button "#B03" [ref=e82]:
            - generic [ref=e83]: "#B03"
          - button "#B04" [ref=e84] [cursor=pointer]:
            - generic [ref=e85]: "#B04"
          - button "#B05" [ref=e86] [cursor=pointer]:
            - generic [ref=e87]: "#B05"
          - button "#B06" [ref=e88]:
            - generic [ref=e89]: "#B06"
        - generic [ref=e90]: Hàng 2
        - generic [ref=e91]:
          - button "#B07" [ref=e92] [cursor=pointer]:
            - generic [ref=e93]: "#B07"
          - button "#B08" [ref=e94] [cursor=pointer]:
            - generic [ref=e95]: "#B08"
        - generic [ref=e96]:
          - generic [ref=e97]:
            - text: Rooftop Container Deck
            - text: Hoàng Hôn Cực Chill
          - generic [ref=e98]: Cầu Thang
  - generic [ref=e100]:
    - button "Huỷ" [ref=e101] [cursor=pointer]
    - button [ref=e102] [cursor=pointer]
  - contentinfo [ref=e104]:
    - generic [ref=e105]:
      - generic [ref=e106]:
        - generic [ref=e107]:
          - img "AURA CAFE" [ref=e108]
          - text: AURA CAFE
        - paragraph [ref=e109]: Where Flavor Meets Design
        - generic [ref=e110]:
          - link "Theo dõi AURA CAFE trên Facebook" [ref=e111] [cursor=pointer]:
            - /url: https://facebook.com/auracafesadec
            - img [ref=e112]
          - link "Theo dõi AURA CAFE trên Instagram" [ref=e114] [cursor=pointer]:
            - /url: https://instagram.com/auracafesadec
            - img [ref=e115]
          - link "Theo dõi AURA CAFE trên TikTok" [ref=e118] [cursor=pointer]:
            - /url: https://tiktok.com/@auracafesadec
            - img [ref=e119]
          - link "Liên hệ AURA CAFE qua Zalo" [ref=e121] [cursor=pointer]:
            - /url: https://zalo.me/0946013633
            - img [ref=e122]
      - generic [ref=e125]:
        - heading "Khám Phá" [level=5] [ref=e126]
        - link "Menu" [ref=e127] [cursor=pointer]:
          - /url: menu.html
        - link "Không Gian" [ref=e128] [cursor=pointer]:
          - /url: index.html#spaces
        - link "Đặt Bàn" [ref=e129] [cursor=pointer]:
          - /url: table-reservation.html
      - generic [ref=e130]:
        - heading "Thành Viên" [level=5] [ref=e131]
        - link "Loyalty & Cashback" [ref=e132] [cursor=pointer]:
          - /url: loyalty.html
        - link "Theo Dõi Đơn" [ref=e133] [cursor=pointer]:
          - /url: track-order.html
      - generic [ref=e134]:
        - heading "Hỗ Trợ & Admin" [level=5] [ref=e135]
        - link "Liên Hệ" [ref=e136] [cursor=pointer]:
          - /url: contact.html
        - link "About" [ref=e137] [cursor=pointer]:
          - /url: about-us.html
        - link "Admin Dashboard" [ref=e138] [cursor=pointer]:
          - /url: /admin/dashboard.html
        - link "KDS" [ref=e139] [cursor=pointer]:
          - /url: kds.html
    - generic [ref=e140]: © 2026 AURA CAFE · Sa Đéc, Đồng Tháp · fnbcontainer.vn v2.1.0
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
> 38  |         await expect(errors).toEqual([]);
      |                              ^ Error: expect(received).toEqual(expected) // deep equality
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
  99  |         expect(hasEmoji).toBe(false);
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
```