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
  - generic [ref=e28]:
    - generic [ref=e29]: THÀNH VIÊN ĐẶC QUYỀN
    - heading "AURA LOYALTY" [level=1] [ref=e30]
    - paragraph [ref=e31]: Tích điểm đổi quà - Nâng hạng nhận đặc quyền không giới hạn tại Aura Space
    - generic [ref=e33]:
      - generic [ref=e36]:
        - generic [ref=e37]:
          - generic [ref=e38]:
            - generic [ref=e39]: 🥉
            - generic [ref=e40]: Thành viên Đồng
          - generic [ref=e41]: "Tham gia: 2/6/2026"
        - generic [ref=e42]: Thành viên
        - generic [ref=e43]:
          - generic [ref=e44]: "0"
          - generic [ref=e45]: points
        - generic [ref=e47]:
          - generic [ref=e48]: 🥉 Thành viên Đồng
          - generic [ref=e49]: 🥈 Thành viên Bạc
      - generic [ref=e51]: Còn 50 pts để lên 🥈 Thành viên Bạc
    - generic [ref=e52]:
      - paragraph [ref=e53]: Nhập số điện thoại để tra cứu điểm & cashback
      - generic [ref=e54]:
        - textbox "0912 345 678" [ref=e55]
        - button "Tra Cứu" [ref=e56] [cursor=pointer]
  - generic [ref=e59]:
    - generic [ref=e60]: ✨
    - heading "Giới Thiệu Bạn Bè - Nhận 200 Points" [level=2] [ref=e61]
    - paragraph [ref=e62]:
      - text: Chia sẻ mã giới thiệu — nhận
      - strong [ref=e63]: 200 points
      - text: khi bạn bè mua hàng lần đầu
    - generic [ref=e64]:
      - generic [ref=e65]:
        - generic [ref=e66]: Mã Của Bạn
        - code [ref=e67]: AURA-XXXX
      - generic [ref=e68]:
        - button "📱 Chia sẻ Zalo" [ref=e69] [cursor=pointer]
        - button "📘 Chia sẻ Facebook" [ref=e70] [cursor=pointer]
        - button "🔗 Copy Link" [ref=e71] [cursor=pointer]
  - generic [ref=e73]:
    - generic [ref=e74]:
      - generic [ref=e75]: Tích Điểm
      - heading "Quyền Lợi & Cách Thức" [level=2] [ref=e76]
    - generic [ref=e77]:
      - generic [ref=e78]:
        - text: ☕
        - heading "Mua Hàng" [level=3] [ref=e79]
        - paragraph [ref=e80]: 10 pts / Món
        - paragraph [ref=e81]: Thưởng điểm ngay cho mỗi hóa đơn thanh toán thành công
      - generic [ref=e82]:
        - text: 🏆
        - heading "Bonus Hạng" [level=3] [ref=e83]
        - paragraph [ref=e84]: Up to 3x
        - paragraph [ref=e85]: Hạng càng cao, tỉ lệ nhân điểm càng vượt trội
      - generic [ref=e86]:
        - text: 🥂
        - heading "Sinh Nhật" [level=3] [ref=e87]
        - paragraph [ref=e88]: +500 pts
        - paragraph [ref=e89]: Quà tặng bí mật từ Aura Space trong tháng sinh nhật
  - generic [ref=e91]:
    - generic [ref=e92]:
      - generic [ref=e93]: Hoạt Động
      - heading "Lịch Sử Giao Dịch" [level=2] [ref=e94]
    - generic [ref=e95]:
      - button "Tất Cả" [ref=e97] [cursor=pointer]
      - generic [ref=e98]:
        - generic [ref=e99]:
          - generic [ref=e100]: ☕
          - generic [ref=e101]:
            - generic [ref=e102]: Cà Phê Phin Truyền Thống × 2
            - generic [ref=e103]: 2/6/2026 · 08:07
          - generic [ref=e104]: +45 ★
        - generic [ref=e105]:
          - generic [ref=e106]: ☕
          - generic [ref=e107]:
            - generic [ref=e108]: Combo Sáng
            - generic [ref=e109]: 1/6/2026 · 09:07
          - generic [ref=e110]: +89 ★
        - generic [ref=e111]:
          - generic [ref=e112]: ☕
          - generic [ref=e113]:
            - generic [ref=e114]: Bạc Xỉu Kem Phô Mai × 1
            - generic [ref=e115]: 31/5/2026 · 09:07
          - generic [ref=e116]: +55 ★
        - generic [ref=e117]:
          - generic [ref=e118]: 🎫
          - generic [ref=e119]:
            - generic [ref=e120]: Đã dùng mã GOLD10
            - generic [ref=e121]: 30/5/2026 · 09:07
          - generic [ref=e122]: "-100 ★"
        - generic [ref=e123]:
          - generic [ref=e124]: ☕
          - generic [ref=e125]:
            - generic [ref=e126]: Cold Brew Nitro × 1
            - generic [ref=e127]: 29/5/2026 · 09:07
          - generic [ref=e128]: +60 ★
  - generic [ref=e130]:
    - generic [ref=e131]:
      - generic [ref=e132]: Cashback
      - heading "Số Dư Cashback" [level=2] [ref=e133]
    - generic [ref=e134]:
      - generic [ref=e135]:
        - generic [ref=e136]: Số dư cashback hiện tại
        - generic [ref=e137]: 125.000₫
        - button "Đổi Cashback" [ref=e138] [cursor=pointer]
      - generic [ref=e139]:
        - generic [ref=e140]: Lịch sử Cashback
        - generic [ref=e141]:
          - generic [ref=e142]:
            - generic [ref=e143]: ☕
            - generic [ref=e144]:
              - generic [ref=e145]: Cà Phê Phin Truyền Thống × 2
              - generic [ref=e146]: 2/6/2026 · 08:07
            - generic [ref=e147]: +45 ★
          - generic [ref=e148]:
            - generic [ref=e149]: ☕
            - generic [ref=e150]:
              - generic [ref=e151]: Combo Sáng
              - generic [ref=e152]: 1/6/2026 · 09:07
            - generic [ref=e153]: +89 ★
          - generic [ref=e154]:
            - generic [ref=e155]: ☕
            - generic [ref=e156]:
              - generic [ref=e157]: Bạc Xỉu Kem Phô Mai × 1
              - generic [ref=e158]: 31/5/2026 · 09:07
            - generic [ref=e159]: +55 ★
          - generic [ref=e160]:
            - generic [ref=e161]: 🎫
            - generic [ref=e162]:
              - generic [ref=e163]: Đã dùng mã GOLD10
              - generic [ref=e164]: 30/5/2026 · 09:07
            - generic [ref=e165]: "-100 ★"
          - generic [ref=e166]:
            - generic [ref=e167]: ☕
            - generic [ref=e168]:
              - generic [ref=e169]: Cold Brew Nitro × 1
              - generic [ref=e170]: 29/5/2026 · 09:07
            - generic [ref=e171]: +60 ★
  - generic [ref=e173]:
    - heading "Sẵn sàng tận hưởng đặc quyền?" [level=2] [ref=e174]
    - generic [ref=e175]:
      - link "ĐẶT MÓN NGAY" [ref=e176]:
        - /url: menu.html
      - link "ĐẶT BÀN" [ref=e177]:
        - /url: table-reservation.html
  - contentinfo [ref=e179]:
    - generic [ref=e180]:
      - generic [ref=e181]:
        - generic [ref=e182]:
          - img "AURA CAFE" [ref=e183]
          - text: AURA CAFE
        - paragraph [ref=e184]: Where Flavor Meets Design
        - generic [ref=e185]:
          - link "Theo dõi AURA CAFE trên Facebook" [ref=e186]:
            - /url: https://facebook.com/auracafesadec
            - img [ref=e187]
          - link "Theo dõi AURA CAFE trên Instagram" [ref=e189]:
            - /url: https://instagram.com/auracafesadec
            - img [ref=e190]
          - link "Theo dõi AURA CAFE trên TikTok" [ref=e193]:
            - /url: https://tiktok.com/@auracafesadec
            - img [ref=e194]
          - link "Liên hệ AURA CAFE qua Zalo" [ref=e196]:
            - /url: https://zalo.me/0946013633
            - img [ref=e197]
      - generic [ref=e200]:
        - heading "Khám Phá" [level=5] [ref=e201]
        - link "Menu" [ref=e202]:
          - /url: menu.html
        - link "Không Gian" [ref=e203]:
          - /url: index.html#spaces
        - link "Đặt Bàn" [ref=e204]:
          - /url: table-reservation.html
      - generic [ref=e205]:
        - heading "Thành Viên" [level=5] [ref=e206]
        - link "Loyalty & Cashback" [ref=e207]:
          - /url: loyalty.html
        - link "Theo Dõi Đơn" [ref=e208]:
          - /url: track-order.html
      - generic [ref=e209]:
        - heading "Hỗ Trợ & Admin" [level=5] [ref=e210]
        - link "Liên Hệ" [ref=e211]:
          - /url: contact.html
        - link "About" [ref=e212]:
          - /url: about-us.html
        - link "Admin Dashboard" [ref=e213]:
          - /url: /admin/dashboard.html
        - link "KDS" [ref=e214]:
          - /url: kds.html
    - generic [ref=e215]: © 2026 AURA CAFE · Sa Đéc, Đồng Tháp · fnbcontainer.vn v2.1.0
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