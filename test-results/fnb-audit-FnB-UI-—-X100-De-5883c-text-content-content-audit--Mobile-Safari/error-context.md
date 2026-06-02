# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fnb-audit.spec.ts >> FnB UI — X100 Deep Audit >> Thanh toán (/checkout.html) >> no emoji in body text content (content audit)
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
  - banner [ref=e27]:
    - generic [ref=e28]:
      - link "← Quay lại Menu" [ref=e29]:
        - /url: menu.html
      - heading "Thanh Toán Đơn Hàng" [level=1] [ref=e30]
  - generic [ref=e32]:
    - generic [ref=e34]:
      - generic [ref=e35]:
        - generic [ref=e36]: Thông Tin Đặt Hàng
        - generic [ref=e37]:
          - generic [ref=e38]: Họ và Tên
          - textbox "Họ và Tên" [ref=e39]:
            - /placeholder: Nguyễn Văn A
        - generic [ref=e40]:
          - generic [ref=e41]: Email
          - textbox "Email" [ref=e42]:
            - /placeholder: email@domain.com
        - generic [ref=e43]:
          - generic [ref=e44]: Số điện thoại
          - textbox "Số điện thoại" [ref=e45]:
            - /placeholder: 09xx xxx xxx
        - generic [ref=e46]:
          - generic [ref=e47]: Địa chỉ giao hàng
          - textbox "Địa chỉ giao hàng" [ref=e48]:
            - /placeholder: Số nhà, đường
        - generic [ref=e49]:
          - generic [ref=e50]: Phường/Xã
          - combobox "Phường/Xã" [ref=e51]:
            - option "Chọn Phường/Xã" [selected]
            - option "Phường 1"
            - option "Phường 2"
            - option "Hòa Thuận"
        - generic [ref=e52]:
          - generic [ref=e53]: Ghi Chú
          - textbox "Ghi Chú" [ref=e54]:
            - /placeholder: Bàn số, yêu cầu đặc biệt...
      - generic [ref=e55]:
        - generic [ref=e56]: Thời Gian Giao Hàng
        - radio "⚡ Giao Ngay 15-30 phút" [checked] [ref=e57] [cursor=pointer]:
          - radio [checked]
          - generic [ref=e58]: ⚡
          - generic [ref=e59]:
            - generic [ref=e60]: Giao Ngay
            - generic [ref=e61]: 15-30 phút
        - radio "📅 Đặt Giờ Chọn thời gian giao" [ref=e63] [cursor=pointer]:
          - radio
          - generic [ref=e64]: 📅
          - generic [ref=e65]:
            - generic [ref=e66]: Đặt Giờ
            - generic [ref=e67]: Chọn thời gian giao
      - generic [ref=e69]:
        - generic [ref=e70]: Phương Thức Thanh Toán
        - radio "💵 Tiền Mặt (COD) Thanh toán khi nhận đồ" [checked] [ref=e71] [cursor=pointer]:
          - radio [checked]
          - generic [ref=e72]: 💵
          - generic [ref=e73]:
            - generic [ref=e74]: Tiền Mặt (COD)
            - generic [ref=e75]: Thanh toán khi nhận đồ
        - radio "🏦 PayOS Chuyển khoản VietQR" [ref=e77] [cursor=pointer]:
          - radio
          - generic [ref=e78]: 🏦
          - generic [ref=e79]:
            - generic [ref=e80]: PayOS
            - generic [ref=e81]: Chuyển khoản VietQR
        - radio
        - radio
      - generic [ref=e83]:
        - generic [ref=e84]: Mã Giảm Giá
        - generic [ref=e85]:
          - textbox "Mã giảm giá" [ref=e86]:
            - /placeholder: "Nhập mã giảm giá (VD: WELCOME)"
          - button "Áp dụng" [ref=e87] [cursor=pointer]
        - generic [ref=e89]: "Gợi ý:"
      - button "⚡ Đặt Hàng" [disabled] [ref=e90]
    - generic [ref=e92]:
      - generic [ref=e93]: Tóm Tắt Đơn Hàng
      - generic [ref=e95]:
        - paragraph [ref=e96]: Giỏ hàng trống
        - link "Quay lại menu" [ref=e97]:
          - /url: menu.html
      - generic [ref=e98]: 🔒 Thanh toán an toàn · SSL mã hóa · Nếu giao dịch lỗi/hết phiên, bạn có thể thử lại ngay và không bị trừ tiền 2 lần.
      - generic [ref=e99]: 🚚 Giao trong 15-30 phút · ⏱️ Hỗ trợ xác nhận trong 5 phút qua hotline/Zalo.
  - contentinfo [ref=e101]:
    - generic [ref=e102]:
      - generic [ref=e103]:
        - generic [ref=e104]:
          - img "AURA CAFE" [ref=e105]
          - text: AURA CAFE
        - paragraph [ref=e106]: Where Flavor Meets Design
        - generic [ref=e107]:
          - link "Theo dõi AURA CAFE trên Facebook" [ref=e108]:
            - /url: https://facebook.com/auracafesadec
            - img [ref=e109]
          - link "Theo dõi AURA CAFE trên Instagram" [ref=e111]:
            - /url: https://instagram.com/auracafesadec
            - img [ref=e112]
          - link "Theo dõi AURA CAFE trên TikTok" [ref=e115]:
            - /url: https://tiktok.com/@auracafesadec
            - img [ref=e116]
          - link "Liên hệ AURA CAFE qua Zalo" [ref=e118]:
            - /url: https://zalo.me/0946013633
            - img [ref=e119]
      - generic [ref=e122]:
        - heading "Khám Phá" [level=5] [ref=e123]
        - link "Menu" [ref=e124]:
          - /url: menu.html
        - link "Không Gian" [ref=e125]:
          - /url: index.html#spaces
        - link "Đặt Bàn" [ref=e126]:
          - /url: table-reservation.html
      - generic [ref=e127]:
        - heading "Thành Viên" [level=5] [ref=e128]
        - link "Loyalty & Cashback" [ref=e129]:
          - /url: loyalty.html
        - link "Theo Dõi Đơn" [ref=e130]:
          - /url: track-order.html
      - generic [ref=e131]:
        - heading "Hỗ Trợ & Admin" [level=5] [ref=e132]
        - link "Liên Hệ" [ref=e133]:
          - /url: contact.html
        - link "About" [ref=e134]:
          - /url: about-us.html
        - link "Admin Dashboard" [ref=e135]:
          - /url: /admin/dashboard.html
        - link "KDS" [ref=e136]:
          - /url: kds.html
    - generic [ref=e137]: © 2026 AURA CAFE · Sa Đéc, Đồng Tháp · fnbcontainer.vn v2.1.0
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