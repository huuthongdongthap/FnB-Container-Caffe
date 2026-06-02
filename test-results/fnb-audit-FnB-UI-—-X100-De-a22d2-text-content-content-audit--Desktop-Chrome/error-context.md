# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fnb-audit.spec.ts >> FnB UI — X100 Deep Audit >> Thực đơn (/menu.html) >> no emoji in body text content (content audit)
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
    - complementary [ref=e32]:
      - generic [ref=e33]:
        - img "AURA CAFE" [ref=e34]
        - text: AURA CAFE
      - generic [ref=e35]:
        - text: 🔍
        - textbox "Tìm món..." [ref=e36]
      - generic [ref=e37]: THỰC ĐƠN
      - navigation [ref=e38]
      - generic [ref=e39]:
        - generic [ref=e40]: KH — Khách Hàng
        - text: Thành viên Gold ★
    - text: 🔍
    - main [ref=e41]:
      - generic [ref=e42]:
        - heading [level=1]
        - generic [ref=e43]:
          - button "⇵ Sắp xếp" [ref=e45] [cursor=pointer]
          - button "Lọc" [ref=e46] [cursor=pointer]
      - generic [ref=e47]:
        - generic [ref=e48]:
          - generic [ref=e49]: ☕
          - heading "Cà phê máy/ phin (Iced/Hot Coffee)" [level=3] [ref=e50]
          - paragraph
          - generic [ref=e51]:
            - generic [ref=e52]: 20.000đ
            - button "+" [ref=e53] [cursor=pointer]
        - generic [ref=e54]:
          - generic [ref=e55]: Best Seller
          - generic [ref=e56]: ☕
          - heading "Cà phê sữa máy/ phin (Iced/Hot Milk Coffee)" [level=3] [ref=e57]
          - paragraph
          - generic [ref=e58]:
            - generic [ref=e59]: 25.000đ
            - button "+" [ref=e60] [cursor=pointer]
        - generic [ref=e61]:
          - generic [ref=e62]: ☕
          - heading "Cà phê/ Matcha muối (Salted Coffee)" [level=3] [ref=e63]
          - paragraph
          - generic [ref=e64]:
            - generic [ref=e65]: 28.000đ
            - button "+" [ref=e66] [cursor=pointer]
        - generic [ref=e67]:
          - generic [ref=e68]: ☕
          - heading "Bạc xỉu đá/ nóng (Iced/Hot White Coffee)" [level=3] [ref=e69]
          - paragraph
          - generic [ref=e70]:
            - generic [ref=e71]: 28.000đ
            - button "+" [ref=e72] [cursor=pointer]
        - generic [ref=e73]:
          - generic [ref=e74]: ☕
          - heading "Ca cao đá/ nóng" [level=3] [ref=e75]
          - paragraph
          - generic [ref=e76]:
            - generic [ref=e77]: 20.000đ
            - button "+" [ref=e78] [cursor=pointer]
        - generic [ref=e79]:
          - generic [ref=e80]: ☕
          - heading "Ca cao sữa đá/ nóng" [level=3] [ref=e81]
          - paragraph
          - generic [ref=e82]:
            - generic [ref=e83]: 30.000đ
            - button "+" [ref=e84] [cursor=pointer]
        - generic [ref=e85]:
          - generic [ref=e86]: ☕
          - heading "Matcha latte đá" [level=3] [ref=e87]
          - paragraph
          - generic [ref=e88]:
            - generic [ref=e89]: 25.000đ
            - button "+" [ref=e90] [cursor=pointer]
        - generic [ref=e91]:
          - generic [ref=e92]: ☕
          - heading "Cà phê kiểu Ý (Espresso)" [level=3] [ref=e93]
          - paragraph
          - generic [ref=e94]:
            - generic [ref=e95]: 20.000đ
            - button "+" [ref=e96] [cursor=pointer]
        - generic [ref=e97]:
          - generic [ref=e98]: ☕
          - heading "Cà phê kiểu Mỹ (Americano)" [level=3] [ref=e99]
          - paragraph
          - generic [ref=e100]:
            - generic [ref=e101]: 25.000đ
            - button "+" [ref=e102] [cursor=pointer]
        - generic [ref=e103]:
          - generic [ref=e104]: ☕
          - heading "Cà phê bọt sữa (Cappuccino)" [level=3] [ref=e105]
          - paragraph
          - generic [ref=e106]:
            - generic [ref=e107]: 35.000đ
            - button "+" [ref=e108] [cursor=pointer]
        - generic [ref=e109]:
          - generic [ref=e110]: ☕
          - heading "Cà phê và Socola (Mocha)" [level=3] [ref=e111]
          - paragraph
          - generic [ref=e112]:
            - generic [ref=e113]: 35.000đ
            - button "+" [ref=e114] [cursor=pointer]
        - generic [ref=e115]:
          - generic [ref=e116]: ☕
          - heading "Cà phê sữa nóng kiểu Ý (Latte)" [level=3] [ref=e117]
          - paragraph
          - generic [ref=e118]:
            - generic [ref=e119]: 35.000đ
            - button "+" [ref=e120] [cursor=pointer]
        - generic [ref=e121]:
          - generic [ref=e122]: ☕
          - heading "Trà xanh sữa nóng (Greentea Latte)" [level=3] [ref=e123]
          - paragraph
          - generic [ref=e124]:
            - generic [ref=e125]: 35.000đ
            - button "+" [ref=e126] [cursor=pointer]
        - generic [ref=e127]:
          - generic [ref=e128]: ☕
          - heading "Cà phê đá xay (Coffee Frappu)" [level=3] [ref=e129]
          - paragraph
          - generic [ref=e130]:
            - generic [ref=e131]: 35.000đ
            - button "+" [ref=e132] [cursor=pointer]
        - generic [ref=e133]:
          - generic [ref=e134]: ☕
          - heading "Cà phê bánh xay (Cookie Frappu)" [level=3] [ref=e135]
          - paragraph
          - generic [ref=e136]:
            - generic [ref=e137]: 35.000đ
            - button "+" [ref=e138] [cursor=pointer]
        - generic [ref=e139]:
          - generic [ref=e140]: ☕
          - heading "Cà phê Socola đá xay (Mocha Frappu)" [level=3] [ref=e141]
          - paragraph
          - generic [ref=e142]:
            - generic [ref=e143]: 35.000đ
            - button "+" [ref=e144] [cursor=pointer]
        - generic [ref=e145]:
          - generic [ref=e146]: ☕
          - heading "Cà phê Dừa Việt quốc (Coconut Blueberry Coffee Ice)" [level=3] [ref=e147]
          - paragraph
          - generic [ref=e148]:
            - generic [ref=e149]: 35.000đ
            - button "+" [ref=e150] [cursor=pointer]
        - generic [ref=e151]:
          - generic [ref=e152]: ☕
          - heading "Sữa chua Việt quốc bánh xay (Blueberry Yogurt Frappu)" [level=3] [ref=e153]
          - paragraph
          - generic [ref=e154]:
            - generic [ref=e155]: 35.000đ
            - button "+" [ref=e156] [cursor=pointer]
        - generic [ref=e157]:
          - generic [ref=e158]: ☕
          - heading "Trà xanh đá xay (Matcha)" [level=3] [ref=e159]
          - paragraph
          - generic [ref=e160]:
            - generic [ref=e161]: 35.000đ
            - button "+" [ref=e162] [cursor=pointer]
        - generic [ref=e163]:
          - generic [ref=e164]: ☕
          - heading "Sinh tố Dâu (Strawberry)" [level=3] [ref=e165]
          - paragraph
          - generic [ref=e166]:
            - generic [ref=e167]: 35.000đ
            - button "+" [ref=e168] [cursor=pointer]
        - generic [ref=e169]:
          - generic [ref=e170]: ☕
          - heading "Sinh tố Bơ (Avocado)" [level=3] [ref=e171]
          - paragraph
          - generic [ref=e172]:
            - generic [ref=e173]: 35.000đ
            - button "+" [ref=e174] [cursor=pointer]
        - generic [ref=e175]:
          - generic [ref=e176]: ☕
          - heading "Sinh tố Mãng cầu (Soursop)" [level=3] [ref=e177]
          - paragraph
          - generic [ref=e178]:
            - generic [ref=e179]: 35.000đ
            - button "+" [ref=e180] [cursor=pointer]
        - generic [ref=e181]:
          - generic [ref=e182]: ☕
          - heading "Sinh tố Sapo (Sapodilla)" [level=3] [ref=e183]
          - paragraph
          - generic [ref=e184]:
            - generic [ref=e185]: 35.000đ
            - button "+" [ref=e186] [cursor=pointer]
        - generic [ref=e187]:
          - generic [ref=e188]: ☕
          - heading "Sapphire (Blue Curacao)" [level=3] [ref=e189]
          - paragraph
          - generic [ref=e190]:
            - generic [ref=e191]: 25.000đ
            - button "+" [ref=e192] [cursor=pointer]
        - generic [ref=e193]:
          - generic [ref=e194]: ☕
          - heading "Emerald (Bạc Hà)" [level=3] [ref=e195]
          - paragraph
          - generic [ref=e196]:
            - generic [ref=e197]: 25.000đ
            - button "+" [ref=e198] [cursor=pointer]
        - generic [ref=e199]:
          - generic [ref=e200]: 🍵
          - heading "Lipton chanh đá/nóng" [level=3] [ref=e201]
          - paragraph
          - generic [ref=e202]:
            - generic [ref=e203]: 18.000đ
            - button "+" [ref=e204] [cursor=pointer]
        - generic [ref=e205]:
          - generic [ref=e206]: 🍵
          - heading "Lipton sữa đá/ nóng" [level=3] [ref=e207]
          - paragraph
          - generic [ref=e208]:
            - generic [ref=e209]: 25.000đ
            - button "+" [ref=e210] [cursor=pointer]
        - generic [ref=e211]:
          - generic [ref=e212]: 🍵
          - heading "Lipton cam đá/ nóng" [level=3] [ref=e213]
          - paragraph
          - generic [ref=e214]:
            - generic [ref=e215]: 25.000đ
            - button "+" [ref=e216] [cursor=pointer]
        - generic [ref=e217]:
          - generic [ref=e218]: 🍵
          - heading "Trà cúc thảo mộc đá/ nóng" [level=3] [ref=e219]
          - paragraph
          - generic [ref=e220]:
            - generic [ref=e221]: 29.000đ
            - button "+" [ref=e222] [cursor=pointer]
        - generic [ref=e223]:
          - generic [ref=e224]: 🍵
          - heading "Trà mãng cầu" [level=3] [ref=e225]
          - paragraph
          - generic [ref=e226]:
            - generic [ref=e227]: 29.000đ
            - button "+" [ref=e228] [cursor=pointer]
        - generic [ref=e229]:
          - generic [ref=e230]: Popular
          - generic [ref=e231]: 🍵
          - heading "Trà đào" [level=3] [ref=e232]
          - paragraph
          - generic [ref=e233]:
            - generic [ref=e234]: 30.000đ
            - button "+" [ref=e235] [cursor=pointer]
        - generic [ref=e236]:
          - generic [ref=e237]: ☕
          - heading "Trà đường" [level=3] [ref=e238]
          - paragraph
          - generic [ref=e239]:
            - generic [ref=e240]: 18.000đ
            - button "+" [ref=e241] [cursor=pointer]
        - generic [ref=e242]:
          - generic [ref=e243]: ☕
          - heading "Bình trà bắc" [level=3] [ref=e244]
          - paragraph
          - generic [ref=e245]:
            - generic [ref=e246]: 15.000đ
            - button "+" [ref=e247] [cursor=pointer]
        - generic [ref=e248]:
          - generic [ref=e249]: ☕
          - heading "Đá me" [level=3] [ref=e250]
          - paragraph
          - generic [ref=e251]:
            - generic [ref=e252]: 18.000đ
            - button "+" [ref=e253] [cursor=pointer]
        - generic [ref=e254]:
          - generic [ref=e255]: ☕
          - heading "Chanh muối" [level=3] [ref=e256]
          - paragraph
          - generic [ref=e257]:
            - generic [ref=e258]: 18.000đ
            - button "+" [ref=e259] [cursor=pointer]
        - generic [ref=e260]:
          - generic [ref=e261]: ☕
          - heading "Sữa tươi" [level=3] [ref=e262]
          - paragraph
          - generic [ref=e263]:
            - generic [ref=e264]: 20.000đ
            - button "+" [ref=e265] [cursor=pointer]
        - generic [ref=e266]:
          - generic [ref=e267]: ☕
          - heading "Yaourt đá" [level=3] [ref=e268]
          - paragraph
          - generic [ref=e269]:
            - generic [ref=e270]: 20.000đ
            - button "+" [ref=e271] [cursor=pointer]
        - generic [ref=e272]:
          - generic [ref=e273]: ☕
          - heading "Yaourt cà phê" [level=3] [ref=e274]
          - paragraph
          - generic [ref=e275]:
            - generic [ref=e276]: 23.000đ
            - button "+" [ref=e277] [cursor=pointer]
        - generic [ref=e278]:
          - generic [ref=e279]: ☕
          - heading "Yaourt Việt Quốc" [level=3] [ref=e280]
          - paragraph
          - generic [ref=e281]:
            - generic [ref=e282]: 25.000đ
            - button "+" [ref=e283] [cursor=pointer]
        - generic [ref=e284]:
          - generic [ref=e285]: ☕
          - heading "Yaourt hủ" [level=3] [ref=e286]
          - paragraph
          - generic [ref=e287]:
            - generic [ref=e288]: 15.000đ
            - button "+" [ref=e289] [cursor=pointer]
        - generic [ref=e290]:
          - generic [ref=e291]: ☕
          - heading "Đá chanh" [level=3] [ref=e292]
          - paragraph
          - generic [ref=e293]:
            - generic [ref=e294]: 18.000đ
            - button "+" [ref=e295] [cursor=pointer]
        - generic [ref=e296]:
          - generic [ref=e297]: ☕
          - heading "Rau má" [level=3] [ref=e298]
          - paragraph
          - generic [ref=e299]:
            - generic [ref=e300]: 18.000đ
            - button "+" [ref=e301] [cursor=pointer]
        - generic [ref=e302]:
          - generic [ref=e303]: ☕
          - heading "Rau má dừa/sữa" [level=3] [ref=e304]
          - paragraph
          - generic [ref=e305]:
            - generic [ref=e306]: 25.000đ
            - button "+" [ref=e307] [cursor=pointer]
        - generic [ref=e308]:
          - generic [ref=e309]: ☕
          - heading "Dừa trái" [level=3] [ref=e310]
          - paragraph
          - generic [ref=e311]:
            - generic [ref=e312]: 23.000đ
            - button "+" [ref=e313] [cursor=pointer]
        - generic [ref=e314]:
          - generic [ref=e315]: ☕
          - heading "Dừa đá" [level=3] [ref=e316]
          - paragraph
          - generic [ref=e317]:
            - generic [ref=e318]: 25.000đ
            - button "+" [ref=e319] [cursor=pointer]
        - generic [ref=e320]:
          - generic [ref=e321]: ☕
          - heading "Cam vắt" [level=3] [ref=e322]
          - paragraph
          - generic [ref=e323]:
            - generic [ref=e324]: 23.000đ
            - button "+" [ref=e325] [cursor=pointer]
        - generic [ref=e326]:
          - generic [ref=e327]: ☕
          - heading "Nước suối" [level=3] [ref=e328]
          - paragraph
          - generic [ref=e329]:
            - generic [ref=e330]: 10.000đ
            - button "+" [ref=e331] [cursor=pointer]
        - generic [ref=e332]:
          - generic [ref=e333]: ☕
          - heading "Sting/ Coca/ Pepsi/ 7 UP/ Ô long" [level=3] [ref=e334]
          - paragraph
          - generic [ref=e335]:
            - generic [ref=e336]: 15.000đ
            - button "+" [ref=e337] [cursor=pointer]
        - generic [ref=e338]:
          - generic [ref=e339]: ☕
          - heading "Redbull" [level=3] [ref=e340]
          - paragraph
          - generic [ref=e341]:
            - generic [ref=e342]: 20.000đ
            - button "+" [ref=e343] [cursor=pointer]
  - generic [ref=e345]:
    - heading "Giỏ Hàng" [level=2] [ref=e346]
    - button "×" [ref=e347] [cursor=pointer]
  - contentinfo [ref=e350]:
    - generic [ref=e351]:
      - generic [ref=e352]:
        - generic [ref=e353]:
          - img "AURA CAFE" [ref=e354]
          - text: AURA CAFE
        - paragraph [ref=e355]: Where Flavor Meets Design
        - generic [ref=e356]:
          - link "Theo dõi AURA CAFE trên Facebook" [ref=e357] [cursor=pointer]:
            - /url: https://facebook.com/auracafesadec
            - img [ref=e358]
          - link "Theo dõi AURA CAFE trên Instagram" [ref=e360] [cursor=pointer]:
            - /url: https://instagram.com/auracafesadec
            - img [ref=e361]
          - link "Theo dõi AURA CAFE trên TikTok" [ref=e364] [cursor=pointer]:
            - /url: https://tiktok.com/@auracafesadec
            - img [ref=e365]
          - link "Liên hệ AURA CAFE qua Zalo" [ref=e367] [cursor=pointer]:
            - /url: https://zalo.me/0946013633
            - img [ref=e368]
      - generic [ref=e371]:
        - heading "Khám Phá" [level=5] [ref=e372]
        - link "Menu" [ref=e373] [cursor=pointer]:
          - /url: menu.html
        - link "Không Gian" [ref=e374] [cursor=pointer]:
          - /url: index.html#spaces
        - link "Đặt Bàn" [ref=e375] [cursor=pointer]:
          - /url: table-reservation.html
      - generic [ref=e376]:
        - heading "Thành Viên" [level=5] [ref=e377]
        - link "Loyalty & Cashback" [ref=e378] [cursor=pointer]:
          - /url: loyalty.html
        - link "Theo Dõi Đơn" [ref=e379] [cursor=pointer]:
          - /url: track-order.html
      - generic [ref=e380]:
        - heading "Hỗ Trợ & Admin" [level=5] [ref=e381]
        - link "Liên Hệ" [ref=e382] [cursor=pointer]:
          - /url: contact.html
        - link "About" [ref=e383] [cursor=pointer]:
          - /url: about-us.html
        - link "Admin Dashboard" [ref=e384] [cursor=pointer]:
          - /url: /admin/dashboard.html
        - link "KDS" [ref=e385] [cursor=pointer]:
          - /url: kds.html
    - generic [ref=e386]: © 2026 AURA CAFE · Sa Đéc, Đồng Tháp · fnbcontainer.vn v2.1.0
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