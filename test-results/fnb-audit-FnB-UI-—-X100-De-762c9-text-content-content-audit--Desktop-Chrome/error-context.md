# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fnb-audit.spec.ts >> FnB UI — X100 Deep Audit >> Tích điểm (/loyalty.html) >> no emoji in body text content (content audit)
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
  - generic [ref=e32]:
    - generic [ref=e33]: THÀNH VIÊN ĐẶC QUYỀN
    - heading "AURA LOYALTY" [level=1] [ref=e34]
    - paragraph [ref=e35]: Tích điểm đổi quà - Nâng hạng nhận đặc quyền không giới hạn tại Aura Space
    - generic [ref=e37]:
      - generic [ref=e40]:
        - generic [ref=e41]:
          - generic [ref=e42]:
            - generic [ref=e43]: 🥉
            - generic [ref=e44]: Thành viên Đồng
          - generic [ref=e45]: "Tham gia: 2/6/2026"
        - generic [ref=e46]: Thành viên
        - generic [ref=e47]:
          - generic [ref=e48]: "0"
          - generic [ref=e49]: points
        - generic [ref=e51]:
          - generic [ref=e52]: 🥉 Thành viên Đồng
          - generic [ref=e53]: 🥈 Thành viên Bạc
      - generic [ref=e55]: Còn 50 pts để lên 🥈 Thành viên Bạc
    - generic [ref=e56]:
      - paragraph [ref=e57]: Nhập số điện thoại để tra cứu điểm & cashback
      - generic [ref=e58]:
        - textbox "0912 345 678" [ref=e59]
        - button "Tra Cứu" [ref=e60] [cursor=pointer]
  - generic [ref=e63]:
    - generic [ref=e64]: ✨
    - heading "Giới Thiệu Bạn Bè - Nhận 200 Points" [level=2] [ref=e65]
    - paragraph [ref=e66]:
      - text: Chia sẻ mã giới thiệu — nhận
      - strong [ref=e67]: 200 points
      - text: khi bạn bè mua hàng lần đầu
    - generic [ref=e68]:
      - generic [ref=e69]:
        - generic [ref=e70]: Mã Của Bạn
        - code [ref=e71]: AURA-XXXX
      - generic [ref=e72]:
        - button "📱 Chia sẻ Zalo" [ref=e73] [cursor=pointer]
        - button "📘 Chia sẻ Facebook" [ref=e74] [cursor=pointer]
        - button "🔗 Copy Link" [ref=e75] [cursor=pointer]
  - generic [ref=e77]:
    - generic [ref=e78]:
      - generic [ref=e79]: Tích Điểm
      - heading "Quyền Lợi & Cách Thức" [level=2] [ref=e80]
    - generic [ref=e81]:
      - generic [ref=e82]:
        - text: ☕
        - heading "Mua Hàng" [level=3] [ref=e83]
        - paragraph [ref=e84]: 10 pts / Món
        - paragraph [ref=e85]: Thưởng điểm ngay cho mỗi hóa đơn thanh toán thành công
      - generic [ref=e86]:
        - text: 🏆
        - heading "Bonus Hạng" [level=3] [ref=e87]
        - paragraph [ref=e88]: Up to 3x
        - paragraph [ref=e89]: Hạng càng cao, tỉ lệ nhân điểm càng vượt trội
      - generic [ref=e90]:
        - text: 🥂
        - heading "Sinh Nhật" [level=3] [ref=e91]
        - paragraph [ref=e92]: +500 pts
        - paragraph [ref=e93]: Quà tặng bí mật từ Aura Space trong tháng sinh nhật
  - generic [ref=e95]:
    - generic [ref=e96]:
      - generic [ref=e97]: Hoạt Động
      - heading "Lịch Sử Giao Dịch" [level=2] [ref=e98]
    - generic [ref=e99]:
      - button "Tất Cả" [ref=e101] [cursor=pointer]
      - generic [ref=e102]:
        - generic [ref=e103]:
          - generic [ref=e104]: ☕
          - generic [ref=e105]:
            - generic [ref=e106]: Cà Phê Phin Truyền Thống × 2
            - generic [ref=e107]: 2/6/2026 · 08:05
          - generic [ref=e108]: +45 ★
        - generic [ref=e109]:
          - generic [ref=e110]: ☕
          - generic [ref=e111]:
            - generic [ref=e112]: Combo Sáng
            - generic [ref=e113]: 1/6/2026 · 09:05
          - generic [ref=e114]: +89 ★
        - generic [ref=e115]:
          - generic [ref=e116]: ☕
          - generic [ref=e117]:
            - generic [ref=e118]: Bạc Xỉu Kem Phô Mai × 1
            - generic [ref=e119]: 31/5/2026 · 09:05
          - generic [ref=e120]: +55 ★
        - generic [ref=e121]:
          - generic [ref=e122]: 🎫
          - generic [ref=e123]:
            - generic [ref=e124]: Đã dùng mã GOLD10
            - generic [ref=e125]: 30/5/2026 · 09:05
          - generic [ref=e126]: "-100 ★"
        - generic [ref=e127]:
          - generic [ref=e128]: ☕
          - generic [ref=e129]:
            - generic [ref=e130]: Cold Brew Nitro × 1
            - generic [ref=e131]: 29/5/2026 · 09:05
          - generic [ref=e132]: +60 ★
  - generic [ref=e134]:
    - generic [ref=e135]:
      - generic [ref=e136]: Cashback
      - heading "Số Dư Cashback" [level=2] [ref=e137]
    - generic [ref=e138]:
      - generic [ref=e139]:
        - generic [ref=e140]: Số dư cashback hiện tại
        - generic [ref=e141]: 125.000₫
        - button "Đổi Cashback" [ref=e142] [cursor=pointer]
      - generic [ref=e143]:
        - generic [ref=e144]: Lịch sử Cashback
        - generic [ref=e145]:
          - generic [ref=e146]:
            - generic [ref=e147]: ☕
            - generic [ref=e148]:
              - generic [ref=e149]: Cà Phê Phin Truyền Thống × 2
              - generic [ref=e150]: 2/6/2026 · 08:05
            - generic [ref=e151]: +45 ★
          - generic [ref=e152]:
            - generic [ref=e153]: ☕
            - generic [ref=e154]:
              - generic [ref=e155]: Combo Sáng
              - generic [ref=e156]: 1/6/2026 · 09:05
            - generic [ref=e157]: +89 ★
          - generic [ref=e158]:
            - generic [ref=e159]: ☕
            - generic [ref=e160]:
              - generic [ref=e161]: Bạc Xỉu Kem Phô Mai × 1
              - generic [ref=e162]: 31/5/2026 · 09:05
            - generic [ref=e163]: +55 ★
          - generic [ref=e164]:
            - generic [ref=e165]: 🎫
            - generic [ref=e166]:
              - generic [ref=e167]: Đã dùng mã GOLD10
              - generic [ref=e168]: 30/5/2026 · 09:05
            - generic [ref=e169]: "-100 ★"
          - generic [ref=e170]:
            - generic [ref=e171]: ☕
            - generic [ref=e172]:
              - generic [ref=e173]: Cold Brew Nitro × 1
              - generic [ref=e174]: 29/5/2026 · 09:05
            - generic [ref=e175]: +60 ★
  - generic [ref=e177]:
    - heading "Sẵn sàng tận hưởng đặc quyền?" [level=2] [ref=e178]
    - generic [ref=e179]:
      - link "ĐẶT MÓN NGAY" [ref=e180] [cursor=pointer]:
        - /url: menu.html
      - link "ĐẶT BÀN" [ref=e181] [cursor=pointer]:
        - /url: table-reservation.html
  - contentinfo [ref=e183]:
    - generic [ref=e184]:
      - generic [ref=e185]:
        - generic [ref=e186]:
          - img "AURA CAFE" [ref=e187]
          - text: AURA CAFE
        - paragraph [ref=e188]: Where Flavor Meets Design
        - generic [ref=e189]:
          - link "Theo dõi AURA CAFE trên Facebook" [ref=e190] [cursor=pointer]:
            - /url: https://facebook.com/auracafesadec
            - img [ref=e191]
          - link "Theo dõi AURA CAFE trên Instagram" [ref=e193] [cursor=pointer]:
            - /url: https://instagram.com/auracafesadec
            - img [ref=e194]
          - link "Theo dõi AURA CAFE trên TikTok" [ref=e197] [cursor=pointer]:
            - /url: https://tiktok.com/@auracafesadec
            - img [ref=e198]
          - link "Liên hệ AURA CAFE qua Zalo" [ref=e200] [cursor=pointer]:
            - /url: https://zalo.me/0946013633
            - img [ref=e201]
      - generic [ref=e204]:
        - heading "Khám Phá" [level=5] [ref=e205]
        - link "Menu" [ref=e206] [cursor=pointer]:
          - /url: menu.html
        - link "Không Gian" [ref=e207] [cursor=pointer]:
          - /url: index.html#spaces
        - link "Đặt Bàn" [ref=e208] [cursor=pointer]:
          - /url: table-reservation.html
      - generic [ref=e209]:
        - heading "Thành Viên" [level=5] [ref=e210]
        - link "Loyalty & Cashback" [ref=e211] [cursor=pointer]:
          - /url: loyalty.html
        - link "Theo Dõi Đơn" [ref=e212] [cursor=pointer]:
          - /url: track-order.html
      - generic [ref=e213]:
        - heading "Hỗ Trợ & Admin" [level=5] [ref=e214]
        - link "Liên Hệ" [ref=e215] [cursor=pointer]:
          - /url: contact.html
        - link "About" [ref=e216] [cursor=pointer]:
          - /url: about-us.html
        - link "Admin Dashboard" [ref=e217] [cursor=pointer]:
          - /url: /admin/dashboard.html
        - link "KDS" [ref=e218] [cursor=pointer]:
          - /url: kds.html
    - generic [ref=e219]: © 2026 AURA CAFE · Sa Đéc, Đồng Tháp · fnbcontainer.vn v2.1.0
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