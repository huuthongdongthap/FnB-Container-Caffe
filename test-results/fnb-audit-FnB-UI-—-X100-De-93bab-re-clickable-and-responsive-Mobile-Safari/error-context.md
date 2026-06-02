# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fnb-audit.spec.ts >> FnB UI — X100 Deep Audit >> Thực đơn (/menu.html) >> nav links are clickable and responsive
- Location: tests/playwright/fnb-audit.spec.ts:111:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('nav, .navbar, #shared-navbar').first().locator('a').nth(1)
    - locator resolved to <a href="index.html" class="snav-link nav-active">Trang Chủ</a>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    83 × waiting for element to be visible, enabled and stable
       - element is not visible
     - retrying click action
       - waiting 500ms
    - waiting for element to be visible, enabled and stable

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - navigation "Main navigation":
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
  - main [ref=e27]:
    - complementary "Đếm ngược khai trương" [ref=e28]:
      - generic [ref=e29]:
        - generic [ref=e30]: 🎉 Khai trương
        - generic [ref=e31]:
          - generic [ref=e32]:
            - generic [ref=e33]: "3"
            - generic [ref=e34]: ngày
          - generic [ref=e35]: ":"
          - generic [ref=e36]:
            - generic [ref=e37]: "14"
            - generic [ref=e38]: giờ
          - generic [ref=e39]: ":"
          - generic [ref=e40]:
            - generic [ref=e41]: "54"
            - generic [ref=e42]: phút
          - generic [ref=e43]: ":"
          - generic [ref=e44]:
            - generic [ref=e45]: "15"
            - generic [ref=e46]: giây
        - link "Đăng ký sớm →" [ref=e47]:
          - /url: /dang-ky-thanh-vien
    - region "AURA CAFE hero — Rooftop Container Café" [ref=e48]:
      - heading "AURA CAFE" [level=1] [ref=e49]
      - generic [ref=e51]:
        - img [ref=e52]
        - generic: EST. 2018
      - generic [ref=e63]:
        - list [ref=e64]:
          - listitem [ref=e65]:
            - img
            - text: Hoàng Hôn Lộng Gió
          - listitem [ref=e68]:
            - img
            - text: Specialty Coffee
          - listitem [ref=e70]:
            - img
            - text: Industrial Lounge
        - generic [ref=e73]:
          - link "Đặt bàn ngay tại AURA CAFE" [ref=e74] [cursor=pointer]:
            - /url: table-reservation.html
            - text: Đặt Bàn Ngay →
          - link "Khám phá thực đơn AURA CAFE" [ref=e75] [cursor=pointer]:
            - /url: menu.html
            - text: Khám Phá Menu
    - region "Thống kê quán" [ref=e76]:
      - generic [ref=e78]:
        - generic [ref=e79]:
          - generic [ref=e80]: "0"
          - generic [ref=e81]: 5 Zone Không Gian
        - generic [ref=e82]:
          - generic [ref=e83]: "0"
          - generic [ref=e84]: 100% Cà Phê Mộc
        - generic [ref=e85]:
          - generic [ref=e86]: "0"
          - generic [ref=e87]: Tầm Nhìn
        - generic [ref=e88]:
          - generic [ref=e89]: "0"
          - generic [ref=e90]: Chỗ Ngồi
    - region "Thực đơn nổi bật" [ref=e91]:
      - generic [ref=e92]:
        - generic [ref=e93]:
          - paragraph [ref=e94]: THỰC ĐƠN NỔI BẬT
          - heading "Món Được Yêu Thích Nhất" [level=2] [ref=e95]
          - paragraph [ref=e96]: Specialty coffee & đồ uống signature độc quyền — được chế biến thủ công mỗi ngày.
        - paragraph [ref=e98]: Đang tải menu...
        - link "Xem toàn bộ menu" [ref=e100]:
          - /url: menu.html
          - text: Xem Toàn Bộ Menu →
    - region "Không gian trải nghiệm AURA CAFE" [ref=e101]:
      - generic [ref=e102]:
        - generic [ref=e103]:
          - paragraph [ref=e104]: 🏛️ THIẾT KẾ ĐỘC BẢN
          - heading "Không Gian Trải Nghiệm 100X Premium" [level=2] [ref=e105]
          - paragraph [ref=e106]: Khám phá 5 phân khu kiến trúc container độc đáo với cấu trúc 2 tầng xếp chồng tinh tế, vật liệu kính cường lực và thép nguyên khối sang trọng.
        - tablist [ref=e107]:
          - tab "Quầy Bar (Jade Counter)" [selected] [ref=e108]
          - tab "Rooftop (Sky Deck)" [ref=e109]
          - tab "Container Seating (Noir Cabin)" [ref=e110]
          - tab "Sunset Corner (Aura Lounge)" [ref=e111]
          - tab "VIP Steel Nest" [ref=e112]
        - tabpanel "Quầy Bar (Jade Counter)" [ref=e113]:
          - generic [ref=e115]:
            - img [ref=e117]
            - text: JADE COUNTER
          - generic [ref=e120]:
            - heading "Quầy Bar — Jade Counter" [level=4] [ref=e121]
            - paragraph [ref=e122]: Mộc Mạc & Tự Nhiên
            - paragraph [ref=e123]: Nằm cuối bên phải tầng trệt, quầy container 20ft được chế tác tinh xảo từ gỗ óc chó (walnut) cao cấp kết hợp mặt đá ngọc bích sang trọng. Bao quanh bởi các chậu cây xanh tươi mát, không gian này mang phong cách Forest Green tự nhiên đem lại cảm giác thanh mát, bình an và sảng khoái.
            - generic [ref=e124]:
              - generic [ref=e125]:
                - generic [ref=e126]: Thiết kế
                - generic [ref=e127]: Walnut & Jade (Gỗ & Đá Ngọc)
              - generic [ref=e128]:
                - generic [ref=e129]: Sức chứa
                - generic [ref=e130]: 15 khách
              - generic [ref=e131]:
                - generic [ref=e132]: Vật liệu
                - generic [ref=e133]: Gỗ óc chó & Đá ngọc bích
              - generic [ref=e134]:
                - generic [ref=e135]: Phong cách
                - generic [ref=e136]: Forest Green thanh lịch
        - tabpanel "Rooftop (Sky Deck)" [ref=e137]:
          - generic [ref=e139]:
            - img [ref=e141]
            - text: SKY DECK
          - generic [ref=e145]:
            - heading "Rooftop — Sky Deck" [level=4] [ref=e146]
            - paragraph [ref=e147]: Khoáng Đạt & Lộng Gió
            - paragraph [ref=e148]: Sân thượng container tầng 2 thoáng đãng và lộng gió, ngắm trọn vẹn cảnh trời đêm phố thị Sa Đéc lung linh. Nơi đây mang phong cách Rooftop khoáng đạt, lý tưởng để bạn thưởng thức ly Cold Brew mát lạnh và đắm mình trong không gian lãng mạn vô tận.
            - generic [ref=e149]:
              - generic [ref=e150]:
                - generic [ref=e151]: Độ cao
                - generic [ref=e152]: 8 mét so với mặt phố Hùng Vương
              - generic [ref=e153]:
                - generic [ref=e154]: Sức chứa
                - generic [ref=e155]: 40 khách
              - generic [ref=e156]:
                - generic [ref=e157]: Không gian
                - generic [ref=e158]: Rooftop ngoài trời
              - generic [ref=e159]:
                - generic [ref=e160]: Tầm nhìn
                - generic [ref=e161]: Phố thị Sa Đéc lung linh
        - tabpanel "Container Seating (Noir Cabin)" [ref=e162]:
          - generic [ref=e164]:
            - img [ref=e166]
            - text: NOIR CABIN
          - generic [ref=e170]:
            - heading "Container Seating — Noir Cabin" [level=4] [ref=e171]
            - paragraph [ref=e172]: Ấm Cúng & Công Nghiệp
            - paragraph [ref=e173]: Không gian phòng lạnh khép kín bên trong container 40ft ấm cúng. Thiết kế vách thép công nghiệp đen rỉ tự nhiên thô mộc, kết hợp hài hòa với những dãy sofa da màu navy sang trọng mang âm hưởng cổ điển, mang lại sự riêng tư tối đa.
            - generic [ref=e174]:
              - generic [ref=e175]:
                - generic [ref=e176]: Tiện nghi
                - generic [ref=e177]: Điều hòa mát lạnh & Cách âm
              - generic [ref=e178]:
                - generic [ref=e179]: Sức chứa
                - generic [ref=e180]: 25 khách
              - generic [ref=e181]:
                - generic [ref=e182]: Kết cấu
                - generic [ref=e183]: Vỏ container 40ft nguyên khối
              - generic [ref=e184]:
                - generic [ref=e185]: Vật liệu
                - generic [ref=e186]: Thép đen rỉ & Da navy
        - tabpanel "Sunset Corner (Aura Lounge)" [ref=e187]:
          - generic [ref=e189]:
            - img [ref=e191]
            - text: AURA LOUNGE
          - generic [ref=e194]:
            - heading "Sunset Corner — Aura Lounge" [level=4] [ref=e195]
            - paragraph [ref=e196]: Tây Hướng Hoàng Hôn
            - paragraph [ref=e197]: Tọa lạc tại góc phía Tây đón trọn vẹn ánh hoàng hôn rực rỡ, Aura Lounge sử dụng các vật liệu inox gương, chrome bóng bẩy phản chiếu ánh sáng cực chất. Không gian mang phong cách Industrial-Luxury mạnh mẽ và sang trọng, đem đến trải nghiệm thư giãn đẳng cấp.
            - generic [ref=e198]:
              - generic [ref=e199]:
                - generic [ref=e200]: Thời điểm vàng
                - generic [ref=e201]: 16:30 - 18:00 (Hoàng hôn)
              - generic [ref=e202]:
                - generic [ref=e203]: Sức chứa
                - generic [ref=e204]: 20 khách
              - generic [ref=e205]:
                - generic [ref=e206]: Vật liệu
                - generic [ref=e207]: Inox gương & Chrome bóng
              - generic [ref=e208]:
                - generic [ref=e209]: Phong cách
                - generic [ref=e210]: Industrial Luxury độc đáo
        - tabpanel "VIP Steel Nest" [ref=e211]:
          - generic [ref=e213]:
            - img [ref=e215]
            - text: VIP STEEL NEST
          - generic [ref=e218]:
            - heading "VIP Steel Nest — Ban Công Treo" [level=4] [ref=e219]
            - paragraph [ref=e220]: Yên Tĩnh & Độc Bản
            - paragraph [ref=e221]: Góc ban công container treo lơ lửng ngoài không gian, kiến tạo trải nghiệm lơ lửng độc bản giữa không trung. Phân khu biệt lập mang tính riêng tư cao, thích hợp cho các buổi gặp gỡ đối tác hay những cuộc trò chuyện sâu lắng.
            - generic [ref=e222]:
              - generic [ref=e223]:
                - generic [ref=e224]: Vị trí
                - generic [ref=e225]: Ban công container treo lửng
              - generic [ref=e226]:
                - generic [ref=e227]: Sức chứa
                - generic [ref=e228]: 10 khách
              - generic [ref=e229]:
                - generic [ref=e230]: Đặc điểm
                - generic [ref=e231]: Biệt lập & Yên tĩnh tuyệt đối
              - generic [ref=e232]:
                - generic [ref=e233]: Thiết kế
                - generic [ref=e234]: Thép công nghiệp xám & Kính
    - region "Chương trình thành viên cashback" [ref=e235]:
      - generic [ref=e236]:
        - generic [ref=e237]:
          - paragraph [ref=e238]: ⭐ CHƯƠNG TRÌNH THÀNH VIÊN
          - heading "Uống Là Có Lời — Cashback Lên Đến 8%" [level=2] [ref=e239]
          - paragraph [ref=e240]: Mỗi ly cà phê đều tích điểm và hoàn tiền vào ví. Càng uống càng lời — lên hạng để nhận thêm ưu đãi.
        - list [ref=e241]:
          - listitem [ref=e242]:
            - generic [ref=e243]: Silver
            - generic [ref=e244]: Thành viên mới
            - generic [ref=e245]: 0%
            - generic [ref=e246]: Cashback mỗi đơn
            - list [ref=e247]:
              - listitem [ref=e248]: ✓ Tích điểm ×1 mỗi đơn
              - listitem [ref=e249]: ✓ Hoàn tiền 2% vào ví
              - listitem [ref=e250]: ✓ Ưu đãi sinh nhật 10%
          - listitem [ref=e251]:
            - text: PHỔ BIẾN NHẤT
            - generic [ref=e252]: Gold
            - generic [ref=e253]: Từ 500 điểm
            - generic [ref=e254]: 0%
            - generic [ref=e255]: Cashback mỗi đơn
            - list [ref=e256]:
              - listitem [ref=e257]: ✓ Tích điểm ×1.5 mỗi đơn
              - listitem [ref=e258]: ✓ Hoàn tiền 5% vào ví
              - listitem [ref=e259]: ✓ Giảm 30% tháng sinh nhật
              - listitem [ref=e260]: ✓ Free upsize 1 lần/tuần
              - listitem [ref=e261]: ✓ Ưu tiên đặt bàn Rooftop
          - listitem [ref=e262]:
            - generic [ref=e263]: Platinum
            - generic [ref=e264]: Từ 1,000 điểm
            - generic [ref=e265]: 0%
            - generic [ref=e266]: Cashback mỗi đơn
            - list [ref=e267]:
              - listitem [ref=e268]: ✓ Tích điểm ×2 mỗi đơn
              - listitem [ref=e269]: ✓ Hoàn tiền 8% vào ví
              - listitem [ref=e270]: ✓ Giảm 50% + quà sinh nhật
              - listitem [ref=e271]: ✓ Free upsize không giới hạn
              - listitem [ref=e272]: ✓ Đặt bàn trước 48 giờ
              - listitem [ref=e273]: ✓ Mời sự kiện VIP exclusive
        - region "Máy tính cashback" [ref=e274]:
          - generic [ref=e275]:
            - text: 💰 Bạn chi
            - textbox "Số tiền chi tiêu hàng tháng" [ref=e276]: "500.000"
            - text: ₫/tháng
          - generic [ref=e277]:
            - generic [ref=e278]:
              - generic [ref=e279]: 🥉 Silver
              - generic [ref=e280]: 10.000₫
              - generic [ref=e281]: "/năm: 120.000₫"
            - generic [ref=e282]:
              - generic [ref=e283]: 🥇 Gold
              - generic [ref=e284]: 25.000₫
              - generic [ref=e285]: "/năm: 300.000₫ 🎉"
            - generic [ref=e286]:
              - generic [ref=e287]: 🏆 Platinum
              - generic [ref=e288]: 40.000₫
              - generic [ref=e289]: "/năm: 480.000₫"
        - generic [ref=e290]:
          - link "Đăng ký thành viên AURA CAFE miễn phí" [ref=e291]:
            - /url: loyalty.html
            - text: Đăng Ký Thành Viên Miễn Phí →
          - paragraph [ref=e292]: Miễn phí đăng ký · Tích điểm ngay từ đơn đầu tiên · Cashback hoàn trong 24h
    - region "Câu chuyện AURA CAFE" [ref=e293]:
      - generic [ref=e295]:
        - generic [ref=e296]:
          - img [ref=e298]
          - heading "Sa Đéc" [level=3] [ref=e301]
          - paragraph [ref=e302]: Đồng Tháp, Vietnam
        - generic [ref=e303]:
          - paragraph [ref=e304]: CÂU CHUYỆN AURA CAFE
          - paragraph [ref=e305]: "Khởi đầu từ một ý tưởng táo bạo: biến container shipping thành không gian cà phê industrial-luxury độc đáo tại mặt phố Nguyễn Tất Thành, Sa Đéc. Chúng tôi kiến tạo nên một điểm đến đầy cảm hứng để cộng đồng gặp gỡ, sáng tạo và tận hưởng những ly specialty coffee tinh tuyển."
          - link "Khám phá thực đơn" [ref=e306]:
            - /url: menu.html
            - text: Khám phá thực đơn →
    - region "Đặt bàn" [ref=e307]:
      - generic [ref=e309]:
        - paragraph [ref=e310]:
          - img [ref=e311]
          - text: SẴN SÀNG TRẢI NGHIỆM?
        - heading "Đặt Bàn Ngay Hôm Nay" [level=2] [ref=e315]
        - paragraph [ref=e316]: Rooftop hoàng hôn, cà phê specialty — tất cả trong một container.
        - generic [ref=e317]:
          - link "Đặt bàn ngay" [ref=e318]:
            - /url: table-reservation.html
            - text: Đặt Bàn Ngay →
          - link "Xem menu" [ref=e319]:
            - /url: menu.html
            - text: Xem Menu
        - list [ref=e320]:
          - listitem [ref=e321]:
            - img [ref=e322]
            - text: 27 Nguyễn Tất Thành, Phường 1
          - listitem [ref=e325]:
            - img [ref=e326]
            - text: "T2-T5: 07:00-22:00 | T6-CN: 06:00-23:00"
          - listitem [ref=e329]:
            - img [ref=e330]
            - text: 0946 013 633
  - contentinfo [ref=e332]:
    - contentinfo [ref=e333]:
      - generic [ref=e334]:
        - generic [ref=e335]:
          - generic [ref=e336]:
            - img "AURA CAFE" [ref=e337]
            - text: AURA CAFE
          - paragraph [ref=e338]: Where Flavor Meets Design
          - generic [ref=e339]:
            - link "Theo dõi AURA CAFE trên Facebook" [ref=e340]:
              - /url: https://facebook.com/auracafesadec
              - img [ref=e341]
            - link "Theo dõi AURA CAFE trên Instagram" [ref=e343]:
              - /url: https://instagram.com/auracafesadec
              - img [ref=e344]
            - link "Theo dõi AURA CAFE trên TikTok" [ref=e347]:
              - /url: https://tiktok.com/@auracafesadec
              - img [ref=e348]
            - link "Liên hệ AURA CAFE qua Zalo" [ref=e350]:
              - /url: https://zalo.me/0946013633
              - img [ref=e351]
        - generic [ref=e354]:
          - heading "Khám Phá" [level=5] [ref=e355]
          - link "Menu" [ref=e356]:
            - /url: menu.html
          - link "Không Gian" [ref=e357]:
            - /url: index.html#spaces
          - link "Đặt Bàn" [ref=e358]:
            - /url: table-reservation.html
        - generic [ref=e359]:
          - heading "Thành Viên" [level=5] [ref=e360]
          - link "Loyalty & Cashback" [ref=e361]:
            - /url: loyalty.html
          - link "Theo Dõi Đơn" [ref=e362]:
            - /url: track-order.html
        - generic [ref=e363]:
          - heading "Hỗ Trợ & Admin" [level=5] [ref=e364]
          - link "Liên Hệ" [ref=e365]:
            - /url: contact.html
          - link "About" [ref=e366]:
            - /url: about-us.html
          - link "Admin Dashboard" [ref=e367]:
            - /url: /admin/dashboard.html
          - link "KDS" [ref=e368]:
            - /url: kds.html
      - generic [ref=e369]: © 2026 AURA CAFE · Sa Đéc, Đồng Tháp · fnbcontainer.vn v2.1.0
```

# Test source

```ts
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
> 118 |             await links.nth(i).click();
      |                                ^ Error: locator.click: Test timeout of 60000ms exceeded.
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