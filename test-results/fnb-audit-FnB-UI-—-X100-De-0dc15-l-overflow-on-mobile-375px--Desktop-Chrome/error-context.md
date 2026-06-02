# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fnb-audit.spec.ts >> FnB UI — X100 Deep Audit >> Thực đơn (/menu.html) >> no horizontal overflow on mobile (375px)
- Location: tests/playwright/fnb-audit.spec.ts:70:7

# Error details

```
Error: page.reload: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - waiting for navigation until "load"

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
        - generic [ref=e7]:
          - button "Chuyển chế độ sáng/tối" [ref=e8] [cursor=pointer]:
            - img [ref=e9]
          - link "Đặt Bàn" [ref=e11] [cursor=pointer]:
            - /url: table-reservation.html
          - button "Mở menu" [ref=e12] [cursor=pointer]
    - dialog "Menu điều hướng" [ref=e16]:
      - link "Trang Chủ" [ref=e17] [cursor=pointer]:
        - /url: index.html
      - link "Menu" [ref=e18] [cursor=pointer]:
        - /url: menu.html
      - link "Không Gian" [ref=e19] [cursor=pointer]:
        - /url: index.html#spaces
      - link "Đặt Bàn" [ref=e20] [cursor=pointer]:
        - /url: table-reservation.html
      - link "Loyalty" [ref=e21] [cursor=pointer]:
        - /url: loyalty.html
      - link "Khuyến Mãi" [ref=e22] [cursor=pointer]:
        - /url: promotions.html
      - link "Liên Hệ" [ref=e23] [cursor=pointer]:
        - /url: contact.html
      - link "Theo Dõi Đơn" [ref=e24] [cursor=pointer]:
        - /url: track-order.html
      - link "About" [ref=e25] [cursor=pointer]:
        - /url: about-us.html
      - link "Đặt Bàn Ngay" [ref=e26] [cursor=pointer]:
        - /url: table-reservation.html
  - generic [ref=e27]:
    - text: 🔍
    - generic [ref=e28]:
      - generic [ref=e29]:
        - generic [ref=e30]:
          - img "AURA CAFE" [ref=e31]
          - text: AURA CAFE
        - button "Mở giỏ hàng" [ref=e32] [cursor=pointer]:
          - img [ref=e33]
      - generic [ref=e36]:
        - text: 🔍
        - textbox "Tìm món..." [ref=e37]
    - main [ref=e39]:
      - generic:
        - heading [level=1]
      - generic [ref=e40]:
        - generic [ref=e41]:
          - generic [ref=e42]: ☕
          - heading "Cà phê máy/ phin (Iced/Hot Coffee)" [level=3] [ref=e43]
          - paragraph
          - generic [ref=e44]:
            - generic [ref=e45]: 20.000đ
            - button "+" [ref=e46] [cursor=pointer]
        - generic [ref=e47]:
          - generic [ref=e48]: Best Seller
          - generic [ref=e49]: ☕
          - heading "Cà phê sữa máy/ phin (Iced/Hot Milk Coffee)" [level=3] [ref=e50]
          - paragraph
          - generic [ref=e51]:
            - generic [ref=e52]: 25.000đ
            - button "+" [ref=e53] [cursor=pointer]
        - generic [ref=e54]:
          - generic [ref=e55]: ☕
          - heading "Cà phê/ Matcha muối (Salted Coffee)" [level=3] [ref=e56]
          - paragraph
          - generic [ref=e57]:
            - generic [ref=e58]: 28.000đ
            - button "+" [ref=e59] [cursor=pointer]
        - generic [ref=e60]:
          - generic [ref=e61]: ☕
          - heading "Bạc xỉu đá/ nóng (Iced/Hot White Coffee)" [level=3] [ref=e62]
          - paragraph
          - generic [ref=e63]:
            - generic [ref=e64]: 28.000đ
            - button "+" [ref=e65] [cursor=pointer]
        - generic [ref=e66]:
          - generic [ref=e67]: ☕
          - heading "Ca cao đá/ nóng" [level=3] [ref=e68]
          - paragraph
          - generic [ref=e69]:
            - generic [ref=e70]: 20.000đ
            - button "+" [ref=e71] [cursor=pointer]
        - generic [ref=e72]:
          - generic [ref=e73]: ☕
          - heading "Ca cao sữa đá/ nóng" [level=3] [ref=e74]
          - paragraph
          - generic [ref=e75]:
            - generic [ref=e76]: 30.000đ
            - button "+" [ref=e77] [cursor=pointer]
        - generic [ref=e78]:
          - generic [ref=e79]: ☕
          - heading "Matcha latte đá" [level=3] [ref=e80]
          - paragraph
          - generic [ref=e81]:
            - generic [ref=e82]: 25.000đ
            - button "+" [ref=e83] [cursor=pointer]
        - generic [ref=e84]:
          - generic [ref=e85]: ☕
          - heading "Cà phê kiểu Ý (Espresso)" [level=3] [ref=e86]
          - paragraph
          - generic [ref=e87]:
            - generic [ref=e88]: 20.000đ
            - button "+" [ref=e89] [cursor=pointer]
        - generic [ref=e90]:
          - generic [ref=e91]: ☕
          - heading "Cà phê kiểu Mỹ (Americano)" [level=3] [ref=e92]
          - paragraph
          - generic [ref=e93]:
            - generic [ref=e94]: 25.000đ
            - button "+" [ref=e95] [cursor=pointer]
        - generic [ref=e96]:
          - generic [ref=e97]: ☕
          - heading "Cà phê bọt sữa (Cappuccino)" [level=3] [ref=e98]
          - paragraph
          - generic [ref=e99]:
            - generic [ref=e100]: 35.000đ
            - button "+" [ref=e101] [cursor=pointer]
        - generic [ref=e102]:
          - generic [ref=e103]: ☕
          - heading "Cà phê và Socola (Mocha)" [level=3] [ref=e104]
          - paragraph
          - generic [ref=e105]:
            - generic [ref=e106]: 35.000đ
            - button "+" [ref=e107] [cursor=pointer]
        - generic [ref=e108]:
          - generic [ref=e109]: ☕
          - heading "Cà phê sữa nóng kiểu Ý (Latte)" [level=3] [ref=e110]
          - paragraph
          - generic [ref=e111]:
            - generic [ref=e112]: 35.000đ
            - button "+" [ref=e113] [cursor=pointer]
        - generic [ref=e114]:
          - generic [ref=e115]: ☕
          - heading "Trà xanh sữa nóng (Greentea Latte)" [level=3] [ref=e116]
          - paragraph
          - generic [ref=e117]:
            - generic [ref=e118]: 35.000đ
            - button "+" [ref=e119] [cursor=pointer]
        - generic [ref=e120]:
          - generic [ref=e121]: ☕
          - heading "Cà phê đá xay (Coffee Frappu)" [level=3] [ref=e122]
          - paragraph
          - generic [ref=e123]:
            - generic [ref=e124]: 35.000đ
            - button "+" [ref=e125] [cursor=pointer]
        - generic [ref=e126]:
          - generic [ref=e127]: ☕
          - heading "Cà phê bánh xay (Cookie Frappu)" [level=3] [ref=e128]
          - paragraph
          - generic [ref=e129]:
            - generic [ref=e130]: 35.000đ
            - button "+" [ref=e131] [cursor=pointer]
        - generic [ref=e132]:
          - generic [ref=e133]: ☕
          - heading "Cà phê Socola đá xay (Mocha Frappu)" [level=3] [ref=e134]
          - paragraph
          - generic [ref=e135]:
            - generic [ref=e136]: 35.000đ
            - button "+" [ref=e137] [cursor=pointer]
        - generic [ref=e138]:
          - generic [ref=e139]: ☕
          - heading "Cà phê Dừa Việt quốc (Coconut Blueberry Coffee Ice)" [level=3] [ref=e140]
          - paragraph
          - generic [ref=e141]:
            - generic [ref=e142]: 35.000đ
            - button "+" [ref=e143] [cursor=pointer]
        - generic [ref=e144]:
          - generic [ref=e145]: ☕
          - heading "Sữa chua Việt quốc bánh xay (Blueberry Yogurt Frappu)" [level=3] [ref=e146]
          - paragraph
          - generic [ref=e147]:
            - generic [ref=e148]: 35.000đ
            - button "+" [ref=e149] [cursor=pointer]
        - generic [ref=e150]:
          - generic [ref=e151]: ☕
          - heading "Trà xanh đá xay (Matcha)" [level=3] [ref=e152]
          - paragraph
          - generic [ref=e153]:
            - generic [ref=e154]: 35.000đ
            - button "+" [ref=e155] [cursor=pointer]
        - generic [ref=e156]:
          - generic [ref=e157]: ☕
          - heading "Sinh tố Dâu (Strawberry)" [level=3] [ref=e158]
          - paragraph
          - generic [ref=e159]:
            - generic [ref=e160]: 35.000đ
            - button "+" [ref=e161] [cursor=pointer]
        - generic [ref=e162]:
          - generic [ref=e163]: ☕
          - heading "Sinh tố Bơ (Avocado)" [level=3] [ref=e164]
          - paragraph
          - generic [ref=e165]:
            - generic [ref=e166]: 35.000đ
            - button "+" [ref=e167] [cursor=pointer]
        - generic [ref=e168]:
          - generic [ref=e169]: ☕
          - heading "Sinh tố Mãng cầu (Soursop)" [level=3] [ref=e170]
          - paragraph
          - generic [ref=e171]:
            - generic [ref=e172]: 35.000đ
            - button "+" [ref=e173] [cursor=pointer]
        - generic [ref=e174]:
          - generic [ref=e175]: ☕
          - heading "Sinh tố Sapo (Sapodilla)" [level=3] [ref=e176]
          - paragraph
          - generic [ref=e177]:
            - generic [ref=e178]: 35.000đ
            - button "+" [ref=e179] [cursor=pointer]
        - generic [ref=e180]:
          - generic [ref=e181]: ☕
          - heading "Sapphire (Blue Curacao)" [level=3] [ref=e182]
          - paragraph
          - generic [ref=e183]:
            - generic [ref=e184]: 25.000đ
            - button "+" [ref=e185] [cursor=pointer]
        - generic [ref=e186]:
          - generic [ref=e187]: ☕
          - heading "Emerald (Bạc Hà)" [level=3] [ref=e188]
          - paragraph
          - generic [ref=e189]:
            - generic [ref=e190]: 25.000đ
            - button "+" [ref=e191] [cursor=pointer]
        - generic [ref=e192]:
          - generic [ref=e193]: 🍵
          - heading "Lipton chanh đá/nóng" [level=3] [ref=e194]
          - paragraph
          - generic [ref=e195]:
            - generic [ref=e196]: 18.000đ
            - button "+" [ref=e197] [cursor=pointer]
        - generic [ref=e198]:
          - generic [ref=e199]: 🍵
          - heading "Lipton sữa đá/ nóng" [level=3] [ref=e200]
          - paragraph
          - generic [ref=e201]:
            - generic [ref=e202]: 25.000đ
            - button "+" [ref=e203] [cursor=pointer]
        - generic [ref=e204]:
          - generic [ref=e205]: 🍵
          - heading "Lipton cam đá/ nóng" [level=3] [ref=e206]
          - paragraph
          - generic [ref=e207]:
            - generic [ref=e208]: 25.000đ
            - button "+" [ref=e209] [cursor=pointer]
        - generic [ref=e210]:
          - generic [ref=e211]: 🍵
          - heading "Trà cúc thảo mộc đá/ nóng" [level=3] [ref=e212]
          - paragraph
          - generic [ref=e213]:
            - generic [ref=e214]: 29.000đ
            - button "+" [ref=e215] [cursor=pointer]
        - generic [ref=e216]:
          - generic [ref=e217]: 🍵
          - heading "Trà mãng cầu" [level=3] [ref=e218]
          - paragraph
          - generic [ref=e219]:
            - generic [ref=e220]: 29.000đ
            - button "+" [ref=e221] [cursor=pointer]
        - generic [ref=e222]:
          - generic [ref=e223]: Popular
          - generic [ref=e224]: 🍵
          - heading "Trà đào" [level=3] [ref=e225]
          - paragraph
          - generic [ref=e226]:
            - generic [ref=e227]: 30.000đ
            - button "+" [ref=e228] [cursor=pointer]
        - generic [ref=e229]:
          - generic [ref=e230]: ☕
          - heading "Trà đường" [level=3] [ref=e231]
          - paragraph
          - generic [ref=e232]:
            - generic [ref=e233]: 18.000đ
            - button "+" [ref=e234] [cursor=pointer]
        - generic [ref=e235]:
          - generic [ref=e236]: ☕
          - heading "Bình trà bắc" [level=3] [ref=e237]
          - paragraph
          - generic [ref=e238]:
            - generic [ref=e239]: 15.000đ
            - button "+" [ref=e240] [cursor=pointer]
        - generic [ref=e241]:
          - generic [ref=e242]: ☕
          - heading "Đá me" [level=3] [ref=e243]
          - paragraph
          - generic [ref=e244]:
            - generic [ref=e245]: 18.000đ
            - button "+" [ref=e246] [cursor=pointer]
        - generic [ref=e247]:
          - generic [ref=e248]: ☕
          - heading "Chanh muối" [level=3] [ref=e249]
          - paragraph
          - generic [ref=e250]:
            - generic [ref=e251]: 18.000đ
            - button "+" [ref=e252] [cursor=pointer]
        - generic [ref=e253]:
          - generic [ref=e254]: ☕
          - heading "Sữa tươi" [level=3] [ref=e255]
          - paragraph
          - generic [ref=e256]:
            - generic [ref=e257]: 20.000đ
            - button "+" [ref=e258] [cursor=pointer]
        - generic [ref=e259]:
          - generic [ref=e260]: ☕
          - heading "Yaourt đá" [level=3] [ref=e261]
          - paragraph
          - generic [ref=e262]:
            - generic [ref=e263]: 20.000đ
            - button "+" [ref=e264] [cursor=pointer]
        - generic [ref=e265]:
          - generic [ref=e266]: ☕
          - heading "Yaourt cà phê" [level=3] [ref=e267]
          - paragraph
          - generic [ref=e268]:
            - generic [ref=e269]: 23.000đ
            - button "+" [ref=e270] [cursor=pointer]
        - generic [ref=e271]:
          - generic [ref=e272]: ☕
          - heading "Yaourt Việt Quốc" [level=3] [ref=e273]
          - paragraph
          - generic [ref=e274]:
            - generic [ref=e275]: 25.000đ
            - button "+" [ref=e276] [cursor=pointer]
        - generic [ref=e277]:
          - generic [ref=e278]: ☕
          - heading "Yaourt hủ" [level=3] [ref=e279]
          - paragraph
          - generic [ref=e280]:
            - generic [ref=e281]: 15.000đ
            - button "+" [ref=e282] [cursor=pointer]
        - generic [ref=e283]:
          - generic [ref=e284]: ☕
          - heading "Đá chanh" [level=3] [ref=e285]
          - paragraph
          - generic [ref=e286]:
            - generic [ref=e287]: 18.000đ
            - button "+" [ref=e288] [cursor=pointer]
        - generic [ref=e289]:
          - generic [ref=e290]: ☕
          - heading "Rau má" [level=3] [ref=e291]
          - paragraph
          - generic [ref=e292]:
            - generic [ref=e293]: 18.000đ
            - button "+" [ref=e294] [cursor=pointer]
        - generic [ref=e295]:
          - generic [ref=e296]: ☕
          - heading "Rau má dừa/sữa" [level=3] [ref=e297]
          - paragraph
          - generic [ref=e298]:
            - generic [ref=e299]: 25.000đ
            - button "+" [ref=e300] [cursor=pointer]
        - generic [ref=e301]:
          - generic [ref=e302]: ☕
          - heading "Dừa trái" [level=3] [ref=e303]
          - paragraph
          - generic [ref=e304]:
            - generic [ref=e305]: 23.000đ
            - button "+" [ref=e306] [cursor=pointer]
        - generic [ref=e307]:
          - generic [ref=e308]: ☕
          - heading "Dừa đá" [level=3] [ref=e309]
          - paragraph
          - generic [ref=e310]:
            - generic [ref=e311]: 25.000đ
            - button "+" [ref=e312] [cursor=pointer]
        - generic [ref=e313]:
          - generic [ref=e314]: ☕
          - heading "Cam vắt" [level=3] [ref=e315]
          - paragraph
          - generic [ref=e316]:
            - generic [ref=e317]: 23.000đ
            - button "+" [ref=e318] [cursor=pointer]
        - generic [ref=e319]:
          - generic [ref=e320]: ☕
          - heading "Nước suối" [level=3] [ref=e321]
          - paragraph
          - generic [ref=e322]:
            - generic [ref=e323]: 10.000đ
            - button "+" [ref=e324] [cursor=pointer]
        - generic [ref=e325]:
          - generic [ref=e326]: ☕
          - heading "Sting/ Coca/ Pepsi/ 7 UP/ Ô long" [level=3] [ref=e327]
          - paragraph
          - generic [ref=e328]:
            - generic [ref=e329]: 15.000đ
            - button "+" [ref=e330] [cursor=pointer]
        - generic [ref=e331]:
          - generic [ref=e332]: ☕
          - heading "Redbull" [level=3] [ref=e333]
          - paragraph
          - generic [ref=e334]:
            - generic [ref=e335]: 20.000đ
            - button "+" [ref=e336] [cursor=pointer]
  - generic [ref=e338]:
    - heading "Giỏ Hàng" [level=2] [ref=e339]
    - button "×" [ref=e340] [cursor=pointer]
  - contentinfo [ref=e343]:
    - generic [ref=e344]:
      - generic [ref=e345]:
        - generic [ref=e346]:
          - img "AURA CAFE" [ref=e347]
          - text: AURA CAFE
        - paragraph [ref=e348]: Where Flavor Meets Design
        - generic [ref=e349]:
          - link "Theo dõi AURA CAFE trên Facebook" [ref=e350] [cursor=pointer]:
            - /url: https://facebook.com/auracafesadec
            - img [ref=e351]
          - link "Theo dõi AURA CAFE trên Instagram" [ref=e353] [cursor=pointer]:
            - /url: https://instagram.com/auracafesadec
            - img [ref=e354]
          - link "Theo dõi AURA CAFE trên TikTok" [ref=e357] [cursor=pointer]:
            - /url: https://tiktok.com/@auracafesadec
            - img [ref=e358]
          - link "Liên hệ AURA CAFE qua Zalo" [ref=e360] [cursor=pointer]:
            - /url: https://zalo.me/0946013633
            - img [ref=e361]
      - generic [ref=e364]:
        - heading "Khám Phá" [level=5] [ref=e365]
        - link "Menu" [ref=e366] [cursor=pointer]:
          - /url: menu.html
        - link "Không Gian" [ref=e367] [cursor=pointer]:
          - /url: index.html#spaces
        - link "Đặt Bàn" [ref=e368] [cursor=pointer]:
          - /url: table-reservation.html
      - generic [ref=e369]:
        - heading "Thành Viên" [level=5] [ref=e370]
        - link "Loyalty & Cashback" [ref=e371] [cursor=pointer]:
          - /url: loyalty.html
        - link "Theo Dõi Đơn" [ref=e372] [cursor=pointer]:
          - /url: track-order.html
      - generic [ref=e373]:
        - heading "Hỗ Trợ & Admin" [level=5] [ref=e374]
        - link "Liên Hệ" [ref=e375] [cursor=pointer]:
          - /url: contact.html
        - link "About" [ref=e376] [cursor=pointer]:
          - /url: about-us.html
        - link "Admin Dashboard" [ref=e377] [cursor=pointer]:
          - /url: /admin/dashboard.html
        - link "KDS" [ref=e378] [cursor=pointer]:
          - /url: kds.html
    - generic [ref=e379]: © 2026 AURA CAFE · Sa Đéc, Đồng Tháp · fnbcontainer.vn v2.1.0
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
> 72  |         await page.reload();
      |                    ^ Error: page.reload: net::ERR_ABORTED; maybe frame was detached?
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