# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fnb-audit.spec.ts >> FnB UI — X100 Deep Audit >> Thanh toán (/checkout.html) >> page loads without console errors
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
    - generic [ref=e32]:
      - link "← Quay lại Menu" [ref=e33] [cursor=pointer]:
        - /url: menu.html
      - heading "Thanh Toán Đơn Hàng" [level=1] [ref=e34]
      - generic [ref=e35]:
        - generic [ref=e36]:
          - generic [ref=e37]: "1"
          - text: Thông tin & Thanh toán
        - generic [ref=e39]:
          - generic [ref=e40]: "2"
          - text: Xác nhận
  - generic [ref=e42]:
    - generic [ref=e44]:
      - generic [ref=e45]:
        - generic [ref=e46]: Thông Tin Đặt Hàng
        - generic [ref=e47]:
          - generic [ref=e48]: Họ và Tên
          - textbox "Họ và Tên" [ref=e49]:
            - /placeholder: Nguyễn Văn A
        - generic [ref=e50]:
          - generic [ref=e51]: Email
          - textbox "Email" [ref=e52]:
            - /placeholder: email@domain.com
        - generic [ref=e53]:
          - generic [ref=e54]: Số điện thoại
          - textbox "Số điện thoại" [ref=e55]:
            - /placeholder: 09xx xxx xxx
        - generic [ref=e56]:
          - generic [ref=e57]: Địa chỉ giao hàng
          - textbox "Địa chỉ giao hàng" [ref=e58]:
            - /placeholder: Số nhà, đường
        - generic [ref=e59]:
          - generic [ref=e60]: Phường/Xã
          - combobox "Phường/Xã" [ref=e61]:
            - option "Chọn Phường/Xã" [selected]
            - option "Phường 1"
            - option "Phường 2"
            - option "Hòa Thuận"
        - generic [ref=e62]:
          - generic [ref=e63]: Ghi Chú
          - textbox "Ghi Chú" [ref=e64]:
            - /placeholder: Bàn số, yêu cầu đặc biệt...
      - generic [ref=e65]:
        - generic [ref=e66]: Thời Gian Giao Hàng
        - radio "⚡ Giao Ngay 15-30 phút" [checked] [ref=e67] [cursor=pointer]:
          - radio [checked]
          - generic [ref=e68]: ⚡
          - generic [ref=e69]:
            - generic [ref=e70]: Giao Ngay
            - generic [ref=e71]: 15-30 phút
        - radio "📅 Đặt Giờ Chọn thời gian giao" [ref=e73] [cursor=pointer]:
          - radio
          - generic [ref=e74]: 📅
          - generic [ref=e75]:
            - generic [ref=e76]: Đặt Giờ
            - generic [ref=e77]: Chọn thời gian giao
      - generic [ref=e79]:
        - generic [ref=e80]: Phương Thức Thanh Toán
        - radio "💵 Tiền Mặt (COD) Thanh toán khi nhận đồ" [checked] [ref=e81] [cursor=pointer]:
          - radio [checked]
          - generic [ref=e82]: 💵
          - generic [ref=e83]:
            - generic [ref=e84]: Tiền Mặt (COD)
            - generic [ref=e85]: Thanh toán khi nhận đồ
        - radio "🏦 PayOS Chuyển khoản VietQR" [ref=e87] [cursor=pointer]:
          - radio
          - generic [ref=e88]: 🏦
          - generic [ref=e89]:
            - generic [ref=e90]: PayOS
            - generic [ref=e91]: Chuyển khoản VietQR
        - radio
        - radio
      - generic [ref=e93]:
        - generic [ref=e94]: Mã Giảm Giá
        - generic [ref=e95]:
          - textbox "Mã giảm giá" [ref=e96]:
            - /placeholder: "Nhập mã giảm giá (VD: WELCOME)"
          - button "Áp dụng" [ref=e97] [cursor=pointer]
        - generic [ref=e99]: "Gợi ý:"
      - button "⚡ Đặt Hàng" [disabled] [ref=e100]
    - generic [ref=e102]:
      - generic [ref=e103]: Tóm Tắt Đơn Hàng
      - generic [ref=e105]:
        - paragraph [ref=e106]: Giỏ hàng trống
        - link "Quay lại menu" [ref=e107] [cursor=pointer]:
          - /url: menu.html
      - generic [ref=e108]: 🔒 Thanh toán an toàn · SSL mã hóa · Nếu giao dịch lỗi/hết phiên, bạn có thể thử lại ngay và không bị trừ tiền 2 lần.
      - generic [ref=e109]: 🚚 Giao trong 15-30 phút · ⏱️ Hỗ trợ xác nhận trong 5 phút qua hotline/Zalo.
  - contentinfo [ref=e111]:
    - generic [ref=e112]:
      - generic [ref=e113]:
        - generic [ref=e114]:
          - img "AURA CAFE" [ref=e115]
          - text: AURA CAFE
        - paragraph [ref=e116]: Where Flavor Meets Design
        - generic [ref=e117]:
          - link "Theo dõi AURA CAFE trên Facebook" [ref=e118] [cursor=pointer]:
            - /url: https://facebook.com/auracafesadec
            - img [ref=e119]
          - link "Theo dõi AURA CAFE trên Instagram" [ref=e121] [cursor=pointer]:
            - /url: https://instagram.com/auracafesadec
            - img [ref=e122]
          - link "Theo dõi AURA CAFE trên TikTok" [ref=e125] [cursor=pointer]:
            - /url: https://tiktok.com/@auracafesadec
            - img [ref=e126]
          - link "Liên hệ AURA CAFE qua Zalo" [ref=e128] [cursor=pointer]:
            - /url: https://zalo.me/0946013633
            - img [ref=e129]
      - generic [ref=e132]:
        - heading "Khám Phá" [level=5] [ref=e133]
        - link "Menu" [ref=e134] [cursor=pointer]:
          - /url: menu.html
        - link "Không Gian" [ref=e135] [cursor=pointer]:
          - /url: index.html#spaces
        - link "Đặt Bàn" [ref=e136] [cursor=pointer]:
          - /url: table-reservation.html
      - generic [ref=e137]:
        - heading "Thành Viên" [level=5] [ref=e138]
        - link "Loyalty & Cashback" [ref=e139] [cursor=pointer]:
          - /url: loyalty.html
        - link "Theo Dõi Đơn" [ref=e140] [cursor=pointer]:
          - /url: track-order.html
      - generic [ref=e141]:
        - heading "Hỗ Trợ & Admin" [level=5] [ref=e142]
        - link "Liên Hệ" [ref=e143] [cursor=pointer]:
          - /url: contact.html
        - link "About" [ref=e144] [cursor=pointer]:
          - /url: about-us.html
        - link "Admin Dashboard" [ref=e145] [cursor=pointer]:
          - /url: /admin/dashboard.html
        - link "KDS" [ref=e146] [cursor=pointer]:
          - /url: kds.html
    - generic [ref=e147]: © 2026 AURA CAFE · Sa Đéc, Đồng Tháp · fnbcontainer.vn v2.1.0
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