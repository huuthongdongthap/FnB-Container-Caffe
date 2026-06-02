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
+   "Failed to load resource: Could not connect to the server.",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic:
    - banner [ref=e2]:
      - generic [ref=e3]:
        - link "AURA CAFE AURA CAFE" [ref=e4]:
          - /url: index.html
          - img "AURA CAFE" [ref=e5]
          - generic [ref=e6]: AURA CAFE
        - generic [ref=e7]:
          - button "Chuyển chế độ sáng/tối" [ref=e8] [cursor=pointer]:
            - img [ref=e9]
          - link "Đặt Bàn" [ref=e11]:
            - /url: table-reservation.html
          - button "Mở menu" [ref=e12] [cursor=pointer]
    - dialog "Menu điều hướng" [ref=e16]:
      - link "Trang Chủ" [ref=e17]:
        - /url: index.html
      - link "Menu" [ref=e18]:
        - /url: menu.html
      - link "Không Gian" [ref=e19]:
        - /url: index.html#spaces
      - link "Đặt Bàn" [ref=e20]:
        - /url: table-reservation.html
      - link "Loyalty" [ref=e21]:
        - /url: loyalty.html
      - link "Khuyến Mãi" [ref=e22]:
        - /url: promotions.html
      - link "Liên Hệ" [ref=e23]:
        - /url: contact.html
      - link "Theo Dõi Đơn" [ref=e24]:
        - /url: track-order.html
      - link "About" [ref=e25]:
        - /url: about-us.html
      - link "Đặt Bàn Ngay" [ref=e26]:
        - /url: table-reservation.html
  - banner [ref=e27]:
    - heading "Đặt Bàn Trực Tuyến" [level=1] [ref=e28]
    - generic [ref=e29]: Real-time
  - generic [ref=e30]:
    - generic [ref=e31]:
      - generic [ref=e32]:
        - generic [ref=e33]: Ngày & Số Khách
        - generic [ref=e34]:
          - textbox [ref=e35]: 2026-06-06
          - combobox [ref=e36]:
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
      - generic [ref=e37]:
        - generic [ref=e38]: Khung Giờ
        - generic [ref=e39]:
          - button "07:00" [ref=e40] [cursor=pointer]
          - button "08:00" [ref=e41] [cursor=pointer]
          - button "09:00" [ref=e42] [cursor=pointer]
          - button "10:00" [ref=e43] [cursor=pointer]
          - button "11:00" [ref=e44] [cursor=pointer]
          - button "14:00" [ref=e45] [cursor=pointer]
          - button "15:00" [ref=e46] [cursor=pointer]
          - button "16:00" [ref=e47] [cursor=pointer]
          - button "17:00" [ref=e48] [cursor=pointer]
          - button "19:00" [ref=e49] [cursor=pointer]
          - button "20:00" [ref=e50] [cursor=pointer]
          - button "21:00" [ref=e51] [cursor=pointer]
      - generic [ref=e52]:
        - generic [ref=e53]: Khu Vực
        - generic [ref=e54]:
          - button "Rooftop" [ref=e55] [cursor=pointer]
          - button "Café Bar" [ref=e56] [cursor=pointer]
          - button "Sân Trống" [ref=e57] [cursor=pointer]
    - generic [ref=e58]:
      - generic [ref=e59]:
        - heading "Mặt Bằng Rooftop" [level=2] [ref=e60]
        - generic [ref=e61]:
          - generic [ref=e62]: Trống
          - generic [ref=e64]: Đang chọn
          - generic [ref=e66]: Đã đặt
      - generic [ref=e69]:
        - generic [ref=e70]: R O O F T O P D E C K
        - generic [ref=e71]: Bar / Quầy pha chế
        - generic [ref=e72]: Hàng 1
        - generic [ref=e73]:
          - button "#B01" [ref=e74] [cursor=pointer]:
            - generic [ref=e75]: "#B01"
          - button "#B02" [ref=e76] [cursor=pointer]:
            - generic [ref=e77]: "#B02"
          - button "#B03" [ref=e78]:
            - generic [ref=e79]: "#B03"
          - button "#B04" [ref=e80] [cursor=pointer]:
            - generic [ref=e81]: "#B04"
          - button "#B05" [ref=e82] [cursor=pointer]:
            - generic [ref=e83]: "#B05"
          - button "#B06" [ref=e84]:
            - generic [ref=e85]: "#B06"
        - generic [ref=e86]: Hàng 2
        - generic [ref=e87]:
          - button "#B07" [ref=e88] [cursor=pointer]:
            - generic [ref=e89]: "#B07"
          - button "#B08" [ref=e90] [cursor=pointer]:
            - generic [ref=e91]: "#B08"
        - generic [ref=e92]:
          - generic [ref=e93]:
            - text: Rooftop Container Deck
            - text: Hoàng Hôn Cực Chill
          - generic [ref=e94]: Cầu Thang
  - generic [ref=e96]:
    - button "Huỷ" [ref=e97] [cursor=pointer]
    - button [ref=e98] [cursor=pointer]
  - contentinfo [ref=e100]:
    - generic [ref=e101]:
      - generic [ref=e102]:
        - generic [ref=e103]:
          - img "AURA CAFE" [ref=e104]
          - text: AURA CAFE
        - paragraph [ref=e105]: Where Flavor Meets Design
        - generic [ref=e106]:
          - link "Theo dõi AURA CAFE trên Facebook" [ref=e107]:
            - /url: https://facebook.com/auracafesadec
            - img [ref=e108]
          - link "Theo dõi AURA CAFE trên Instagram" [ref=e110]:
            - /url: https://instagram.com/auracafesadec
            - img [ref=e111]
          - link "Theo dõi AURA CAFE trên TikTok" [ref=e114]:
            - /url: https://tiktok.com/@auracafesadec
            - img [ref=e115]
          - link "Liên hệ AURA CAFE qua Zalo" [ref=e117]:
            - /url: https://zalo.me/0946013633
            - img [ref=e118]
      - generic [ref=e121]:
        - heading "Khám Phá" [level=5] [ref=e122]
        - link "Menu" [ref=e123]:
          - /url: menu.html
        - link "Không Gian" [ref=e124]:
          - /url: index.html#spaces
        - link "Đặt Bàn" [ref=e125]:
          - /url: table-reservation.html
      - generic [ref=e126]:
        - heading "Thành Viên" [level=5] [ref=e127]
        - link "Loyalty & Cashback" [ref=e128]:
          - /url: loyalty.html
        - link "Theo Dõi Đơn" [ref=e129]:
          - /url: track-order.html
      - generic [ref=e130]:
        - heading "Hỗ Trợ & Admin" [level=5] [ref=e131]
        - link "Liên Hệ" [ref=e132]:
          - /url: contact.html
        - link "About" [ref=e133]:
          - /url: about-us.html
        - link "Admin Dashboard" [ref=e134]:
          - /url: /admin/dashboard.html
        - link "KDS" [ref=e135]:
          - /url: kds.html
    - generic [ref=e136]: © 2026 AURA CAFE · Sa Đéc, Đồng Tháp · fnbcontainer.vn v2.1.0
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