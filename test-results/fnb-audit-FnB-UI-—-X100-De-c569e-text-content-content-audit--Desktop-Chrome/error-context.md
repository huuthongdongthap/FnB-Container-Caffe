# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fnb-audit.spec.ts >> FnB UI — X100 Deep Audit >> Giới thiệu (/about-us.html) >> no emoji in body text content (content audit)
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
    - heading "Về Chúng Tôi" [level=1] [ref=e33]
    - paragraph [ref=e34]: Từ tình yêu Sa Đéc đến không gian container độc đáo
  - generic [ref=e36]:
    - generic [ref=e37]:
      - generic [ref=e38]: Hành Trình
      - heading "Lịch Sử Hình Thành" [level=2] [ref=e39]
      - paragraph [ref=e40]: Câu chuyện của chúng tôi bắt đầu từ một ý tưởng đơn giản
    - generic [ref=e41]:
      - generic [ref=e42]:
        - generic [ref=e43]: "2024"
        - generic [ref=e44]:
          - heading "Ý Tưởng Ban Đầu" [level=3] [ref=e45]
          - paragraph [ref=e46]: Trong một lần đi công tác tại các thành phố lớn, chúng tôi nhận thấy mô hình quán cafe container đang rất phổ biến. Với tình yêu dành cho Sa Đéc và mong muốn mang đến không gian mới lạ cho quê hương, ý tưởng về AURA CAFE bắt đầu hình thành.
      - generic [ref=e47]:
        - generic [ref=e48]: Q1/2025
        - generic [ref=e49]:
          - heading "Khởi Công Xây Dựng" [level=3] [ref=e50]
          - paragraph [ref=e51]: Sau 6 tháng lên kế hoạch và thiết kế, chúng tôi chính thức khởi công xây dựng trên mảnh đất ~183m² tại đường Hùng Vương. Kiến trúc container 40ft + 2×20ft được thiết kế bởi đội ngũ kiến trúc sư giàu kinh nghiệm.
      - generic [ref=e52]:
        - generic [ref=e53]: Q3/2025
        - generic [ref=e54]:
          - heading "Hoàn Thiện & Đào Tạo" [level=3] [ref=e55]
          - paragraph [ref=e56]: Công trình hoàn thành sau 8 tháng thi công. Đội ngũ nhân viên được tuyển chọn và đào tạo bài bản về pha chế, phục vụ và chăm sóc khách hàng theo tiêu chuẩn 5 sao.
      - generic [ref=e57]:
        - generic [ref=e58]: 01/2026
        - generic [ref=e59]:
          - heading "Chính Thức Khai Trương" [level=3] [ref=e60]
          - paragraph [ref=e61]: AURA CAFE chính thức mở cửa đón khách vào ngày 1 tháng 1 năm 2026. Với không gian độc đáo, specialty coffee chất lượng và view rooftop tuyệt đẹp, chúng tôi nhanh chóng trở thành điểm đến hot nhất Sa Đéc.
      - generic [ref=e62]:
        - generic [ref=e63]: Hiện Tại
        - generic [ref=e64]:
          - heading "Phát Triển & Vươn Xa" [level=3] [ref=e65]
          - paragraph [ref=e66]: Không ngừng cải thiện chất lượng dịch vụ, mở rộng menu và xây dựng cộng đồng yêu cafe tại Sa Đéc. Chúng tôi tự hào là nơi kết nối những người trẻ yêu cà phê và không gian sáng tạo.
  - generic [ref=e68]:
    - generic [ref=e69]:
      - generic [ref=e70]: Giá Trị Cốt Lõi
      - heading "Điều Chúng Tôi Tin" [level=2] [ref=e71]
    - generic [ref=e72]:
      - generic [ref=e73]:
        - generic [ref=e74]: ☕
        - heading "Chất Lượng" [level=3] [ref=e75]
        - paragraph [ref=e76]: 100% cà phê nguyên chất từ Buôn Ma Thuột, không pha trộn, không chất bảo quản.
      - generic [ref=e77]:
        - generic [ref=e78]: 🌱
        - heading "Bền Vững" [level=3] [ref=e79]
        - paragraph [ref=e80]: Tái chế container, sử dụng nguyên liệu thân thiện môi trường, hỗ trợ nông dân địa phương.
      - generic [ref=e81]:
        - generic [ref=e82]: 🤝
        - heading "Kết Nối" [level=3] [ref=e83]
        - paragraph [ref=e84]: Tạo không gian để mọi người gặp gỡ, chia sẻ và cùng nhau phát triển.
      - generic [ref=e85]:
        - generic [ref=e86]: ✨
        - heading "Sáng Tạo" [level=3] [ref=e87]
        - paragraph [ref=e88]: Không ngừng đổi mới trong từng món đồ uống, từng trải nghiệm khách hàng.
  - generic [ref=e90]:
    - generic [ref=e91]:
      - generic [ref=e92]: Đội Ngũ
      - heading "Gặp Gỡ Chúng Tôi" [level=2] [ref=e93]
      - paragraph [ref=e94]: Những con người tạo nên linh hồn của AURA CAFE
    - generic [ref=e95]:
      - generic [ref=e96]:
        - generic [ref=e97]: 👨‍💼
        - generic [ref=e98]:
          - heading "Nguyễn Văn A" [level=3] [ref=e99]
          - paragraph [ref=e100]: Founder & CEO
          - paragraph [ref=e101]: 10 năm kinh nghiệm trong ngành cafe & nhà hàng. Đam mê mang đến không gian cà phê chất lượng cho quê hương Sa Đéc.
      - generic [ref=e102]:
        - generic [ref=e103]: 👩‍🍳
        - generic [ref=e104]:
          - heading "Trần Thị B" [level=3] [ref=e105]
          - paragraph [ref=e106]: Head Barista
          - paragraph [ref=e107]: Chứng chỉ Q Grader quốc tế. Chuyên gia về rang xay và pha chế cà phê specialty.
      - generic [ref=e108]:
        - generic [ref=e109]: 👨‍🎨
        - generic [ref=e110]:
          - heading "Lê Văn C" [level=3] [ref=e111]
          - paragraph [ref=e112]: Creative Director
          - paragraph [ref=e113]: Người đứng sau các concept trang trí và trải nghiệm khách hàng độc đáo của quán.
      - generic [ref=e114]:
        - generic [ref=e115]: 👩‍💼
        - generic [ref=e116]:
          - heading "Phạm Thị D" [level=3] [ref=e117]
          - paragraph [ref=e118]: Operations Manager
          - paragraph [ref=e119]: Đảm bảo mọi hoạt động của quán diễn ra trơn tru, từ nguyên liệu đến dịch vụ.
      - generic [ref=e120]:
        - generic [ref=e121]: 👨‍🔧
        - generic [ref=e122]:
          - heading "Hoàng Văn E" [level=3] [ref=e123]
          - paragraph [ref=e124]: Head Chef
          - paragraph [ref=e125]: Sáng tạo các món ăn kèm và bánh ngọt tươi mới mỗi ngày, kết hợp hương vị Á-Âu.
      - generic [ref=e126]:
        - generic [ref=e127]: 👩‍🎤
        - generic [ref=e128]:
          - heading "Vũ Thị F" [level=3] [ref=e129]
          - paragraph [ref=e130]: Marketing Lead
          - paragraph [ref=e131]: Xây dựng cộng đồng và kết nối khách hàng thông qua các chiến dịch sáng tạo.
  - generic [ref=e133]:
    - generic [ref=e134]:
      - generic [ref=e135]: Thư Viện
      - heading "Hình Ảnh" [level=2] [ref=e136]
      - paragraph [ref=e137]: Những khoảnh khắc đáng nhớ tại AURA CAFE
    - generic [ref=e138]:
      - generic [ref=e139] [cursor=pointer]:
        - img "Mặt tiền AURA CAFE" [ref=e140]
        - generic [ref=e141]: Mặt tiền container industrial-luxury
      - generic [ref=e142] [cursor=pointer]:
        - img "Không gian nội thất" [ref=e143]
        - generic [ref=e144]: Nội thất industrial chic
      - generic [ref=e145] [cursor=pointer]:
        - img "AURA CAFE về đêm" [ref=e146]
        - generic [ref=e147]: Rực rỡ灯光 về đêm
      - generic [ref=e148] [cursor=pointer]:
        - img "Rooftop bar container deck" [ref=e149]
        - generic [ref=e150]: Rooftop bar hoàng hôn
      - generic [ref=e151] [cursor=pointer]:
        - img "Latte art" [ref=e152]
        - generic [ref=e153]: Latte art đỉnh cao
      - generic [ref=e154] [cursor=pointer]:
        - img "Không gian làm việc" [ref=e155]
        - generic [ref=e156]: Work zone yên tĩnh
      - generic [ref=e157] [cursor=pointer]:
        - img "Sự kiện tại quán" [ref=e158]
        - generic [ref=e159]: Sinh nhật & gathering
      - generic [ref=e160] [cursor=pointer]:
        - img "Meeting room" [ref=e161]
        - generic [ref=e162]: Meeting room riêng tư
  - generic [ref=e164]:
    - heading "Đến Và Trải Nghiệm" [level=2] [ref=e165]
    - paragraph [ref=e166]: Ghé thăm AURA CAFE để cảm nhận không gian độc đáo và thưởng thức những ly cà phê tuyệt hảo.
    - generic [ref=e167]:
      - link "☕ Xem Menu" [ref=e168] [cursor=pointer]:
        - /url: menu.html
      - link "📍 Chỉ Đường" [ref=e169] [cursor=pointer]:
        - /url: https://maps.google.com/?q=39+Nguyen+Tat+Thanh+Sa+Dec+Dong+Thap
      - link "📞 Đặt Bàn" [ref=e170] [cursor=pointer]:
        - /url: table-reservation.html
  - contentinfo [ref=e172]:
    - generic [ref=e173]:
      - generic [ref=e174]:
        - generic [ref=e175]:
          - img "AURA CAFE" [ref=e176]
          - text: AURA CAFE
        - paragraph [ref=e177]: Where Flavor Meets Design
        - generic [ref=e178]:
          - link "Theo dõi AURA CAFE trên Facebook" [ref=e179] [cursor=pointer]:
            - /url: https://facebook.com/auracafesadec
            - img [ref=e180]
          - link "Theo dõi AURA CAFE trên Instagram" [ref=e182] [cursor=pointer]:
            - /url: https://instagram.com/auracafesadec
            - img [ref=e183]
          - link "Theo dõi AURA CAFE trên TikTok" [ref=e186] [cursor=pointer]:
            - /url: https://tiktok.com/@auracafesadec
            - img [ref=e187]
          - link "Liên hệ AURA CAFE qua Zalo" [ref=e189] [cursor=pointer]:
            - /url: https://zalo.me/0946013633
            - img [ref=e190]
      - generic [ref=e193]:
        - heading "Khám Phá" [level=5] [ref=e194]
        - link "Menu" [ref=e195] [cursor=pointer]:
          - /url: menu.html
        - link "Không Gian" [ref=e196] [cursor=pointer]:
          - /url: index.html#spaces
        - link "Đặt Bàn" [ref=e197] [cursor=pointer]:
          - /url: table-reservation.html
      - generic [ref=e198]:
        - heading "Thành Viên" [level=5] [ref=e199]
        - link "Loyalty & Cashback" [ref=e200] [cursor=pointer]:
          - /url: loyalty.html
        - link "Theo Dõi Đơn" [ref=e201] [cursor=pointer]:
          - /url: track-order.html
      - generic [ref=e202]:
        - heading "Hỗ Trợ & Admin" [level=5] [ref=e203]
        - link "Liên Hệ" [ref=e204] [cursor=pointer]:
          - /url: contact.html
        - link "About" [ref=e205] [cursor=pointer]:
          - /url: about-us.html
        - link "Admin Dashboard" [ref=e206] [cursor=pointer]:
          - /url: /admin/dashboard.html
        - link "KDS" [ref=e207] [cursor=pointer]:
          - /url: kds.html
    - generic [ref=e208]: © 2026 AURA CAFE · Sa Đéc, Đồng Tháp · fnbcontainer.vn v2.1.0
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