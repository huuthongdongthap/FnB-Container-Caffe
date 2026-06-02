# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fnb-audit.spec.ts >> FnB UI — X100 Deep Audit >> Trang chủ (/) >> page loads without console errors
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
  - navigation "Main navigation":
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
  - main [ref=e31]:
    - complementary "Đếm ngược khai trương" [ref=e32]:
      - generic [ref=e33]:
        - generic [ref=e34]: 🎉 Khai trương
        - generic [ref=e35]: 06 / 06 / 2026
        - generic [ref=e36]: —
        - generic [ref=e37]:
          - generic [ref=e38]:
            - generic [ref=e39]: "3"
            - generic [ref=e40]: ngày
          - generic [ref=e41]: ":"
          - generic [ref=e42]:
            - generic [ref=e43]: "14"
            - generic [ref=e44]: giờ
          - generic [ref=e45]: ":"
          - generic [ref=e46]:
            - generic [ref=e47]: "57"
            - generic [ref=e48]: phút
          - generic [ref=e49]: ":"
          - generic [ref=e50]:
            - generic [ref=e51]: "19"
            - generic [ref=e52]: giây
        - link "Đăng ký sớm →" [ref=e53] [cursor=pointer]:
          - /url: /dang-ky-thanh-vien
    - region "AURA CAFE hero — Rooftop Container Café" [ref=e54]:
      - heading "AURA CAFE" [level=1] [ref=e55]
      - generic [ref=e57]:
        - img [ref=e58]
        - generic: EST. 2018
      - generic [ref=e69]:
        - list [ref=e70]:
          - listitem [ref=e71]:
            - img [ref=e72]
            - text: Hoàng Hôn Lộng Gió
          - listitem [ref=e75]:
            - img [ref=e76]
            - text: Specialty Coffee
          - listitem [ref=e78]:
            - img [ref=e79]
            - text: Industrial Lounge
        - generic [ref=e82]:
          - link "Đặt bàn ngay tại AURA CAFE" [ref=e83] [cursor=pointer]:
            - /url: table-reservation.html
            - text: Đặt Bàn Ngay →
          - link "Khám phá thực đơn AURA CAFE" [ref=e84] [cursor=pointer]:
            - /url: menu.html
            - text: Khám Phá Menu
    - region "Thống kê quán" [ref=e85]:
      - generic [ref=e87]:
        - generic [ref=e88]:
          - generic [ref=e89]: "0"
          - generic [ref=e90]: 5 Zone Không Gian
        - generic [ref=e91]:
          - generic [ref=e92]: "0"
          - generic [ref=e93]: 100% Cà Phê Mộc
        - generic [ref=e94]:
          - generic [ref=e95]: "0"
          - generic [ref=e96]: Tầm Nhìn
        - generic [ref=e97]:
          - generic [ref=e98]: "0"
          - generic [ref=e99]: Chỗ Ngồi
    - region "Thực đơn nổi bật" [ref=e100]:
      - generic [ref=e101]:
        - generic [ref=e102]:
          - paragraph [ref=e103]: THỰC ĐƠN NỔI BẬT
          - heading "Món Được Yêu Thích Nhất" [level=2] [ref=e104]
          - paragraph [ref=e105]: Specialty coffee & đồ uống signature độc quyền — được chế biến thủ công mỗi ngày.
        - paragraph [ref=e107]: Đang tải menu...
        - link "Xem toàn bộ menu" [ref=e109] [cursor=pointer]:
          - /url: menu.html
          - text: Xem Toàn Bộ Menu →
    - region "Không gian trải nghiệm AURA CAFE" [ref=e110]:
      - generic [ref=e111]:
        - generic [ref=e112]:
          - paragraph [ref=e113]: 🏛️ THIẾT KẾ ĐỘC BẢN
          - heading "Không Gian Trải Nghiệm 100X Premium" [level=2] [ref=e114]
          - paragraph [ref=e115]: Khám phá 5 phân khu kiến trúc container độc đáo với cấu trúc 2 tầng xếp chồng tinh tế, vật liệu kính cường lực và thép nguyên khối sang trọng.
        - tablist [ref=e116]:
          - tab "Quầy Bar (Jade Counter)" [selected] [ref=e117]
          - tab "Rooftop (Sky Deck)" [ref=e118]
          - tab "Container Seating (Noir Cabin)" [ref=e119]
          - tab "Sunset Corner (Aura Lounge)" [ref=e120]
          - tab "VIP Steel Nest" [ref=e121]
        - tabpanel "Quầy Bar (Jade Counter)" [ref=e122]:
          - generic [ref=e124]:
            - img [ref=e126]
            - text: JADE COUNTER
          - generic [ref=e129]:
            - heading "Quầy Bar — Jade Counter" [level=4] [ref=e130]
            - paragraph [ref=e131]: Mộc Mạc & Tự Nhiên
            - paragraph [ref=e132]: Nằm cuối bên phải tầng trệt, quầy container 20ft được chế tác tinh xảo từ gỗ óc chó (walnut) cao cấp kết hợp mặt đá ngọc bích sang trọng. Bao quanh bởi các chậu cây xanh tươi mát, không gian này mang phong cách Forest Green tự nhiên đem lại cảm giác thanh mát, bình an và sảng khoái.
            - generic [ref=e133]:
              - generic [ref=e134]:
                - generic [ref=e135]: Thiết kế
                - generic [ref=e136]: Walnut & Jade (Gỗ & Đá Ngọc)
              - generic [ref=e137]:
                - generic [ref=e138]: Sức chứa
                - generic [ref=e139]: 15 khách
              - generic [ref=e140]:
                - generic [ref=e141]: Vật liệu
                - generic [ref=e142]: Gỗ óc chó & Đá ngọc bích
              - generic [ref=e143]:
                - generic [ref=e144]: Phong cách
                - generic [ref=e145]: Forest Green thanh lịch
        - tabpanel "Rooftop (Sky Deck)" [ref=e146]:
          - generic [ref=e148]:
            - img [ref=e150]
            - text: SKY DECK
          - generic [ref=e154]:
            - heading "Rooftop — Sky Deck" [level=4] [ref=e155]
            - paragraph [ref=e156]: Khoáng Đạt & Lộng Gió
            - paragraph [ref=e157]: Sân thượng container tầng 2 thoáng đãng và lộng gió, ngắm trọn vẹn cảnh trời đêm phố thị Sa Đéc lung linh. Nơi đây mang phong cách Rooftop khoáng đạt, lý tưởng để bạn thưởng thức ly Cold Brew mát lạnh và đắm mình trong không gian lãng mạn vô tận.
            - generic [ref=e158]:
              - generic [ref=e159]:
                - generic [ref=e160]: Độ cao
                - generic [ref=e161]: 8 mét so với mặt phố Hùng Vương
              - generic [ref=e162]:
                - generic [ref=e163]: Sức chứa
                - generic [ref=e164]: 40 khách
              - generic [ref=e165]:
                - generic [ref=e166]: Không gian
                - generic [ref=e167]: Rooftop ngoài trời
              - generic [ref=e168]:
                - generic [ref=e169]: Tầm nhìn
                - generic [ref=e170]: Phố thị Sa Đéc lung linh
        - tabpanel "Container Seating (Noir Cabin)" [ref=e171]:
          - generic [ref=e173]:
            - img [ref=e175]
            - text: NOIR CABIN
          - generic [ref=e179]:
            - heading "Container Seating — Noir Cabin" [level=4] [ref=e180]
            - paragraph [ref=e181]: Ấm Cúng & Công Nghiệp
            - paragraph [ref=e182]: Không gian phòng lạnh khép kín bên trong container 40ft ấm cúng. Thiết kế vách thép công nghiệp đen rỉ tự nhiên thô mộc, kết hợp hài hòa với những dãy sofa da màu navy sang trọng mang âm hưởng cổ điển, mang lại sự riêng tư tối đa.
            - generic [ref=e183]:
              - generic [ref=e184]:
                - generic [ref=e185]: Tiện nghi
                - generic [ref=e186]: Điều hòa mát lạnh & Cách âm
              - generic [ref=e187]:
                - generic [ref=e188]: Sức chứa
                - generic [ref=e189]: 25 khách
              - generic [ref=e190]:
                - generic [ref=e191]: Kết cấu
                - generic [ref=e192]: Vỏ container 40ft nguyên khối
              - generic [ref=e193]:
                - generic [ref=e194]: Vật liệu
                - generic [ref=e195]: Thép đen rỉ & Da navy
        - tabpanel "Sunset Corner (Aura Lounge)" [ref=e196]:
          - generic [ref=e198]:
            - img [ref=e200]
            - text: AURA LOUNGE
          - generic [ref=e203]:
            - heading "Sunset Corner — Aura Lounge" [level=4] [ref=e204]
            - paragraph [ref=e205]: Tây Hướng Hoàng Hôn
            - paragraph [ref=e206]: Tọa lạc tại góc phía Tây đón trọn vẹn ánh hoàng hôn rực rỡ, Aura Lounge sử dụng các vật liệu inox gương, chrome bóng bẩy phản chiếu ánh sáng cực chất. Không gian mang phong cách Industrial-Luxury mạnh mẽ và sang trọng, đem đến trải nghiệm thư giãn đẳng cấp.
            - generic [ref=e207]:
              - generic [ref=e208]:
                - generic [ref=e209]: Thời điểm vàng
                - generic [ref=e210]: 16:30 - 18:00 (Hoàng hôn)
              - generic [ref=e211]:
                - generic [ref=e212]: Sức chứa
                - generic [ref=e213]: 20 khách
              - generic [ref=e214]:
                - generic [ref=e215]: Vật liệu
                - generic [ref=e216]: Inox gương & Chrome bóng
              - generic [ref=e217]:
                - generic [ref=e218]: Phong cách
                - generic [ref=e219]: Industrial Luxury độc đáo
        - tabpanel "VIP Steel Nest" [ref=e220]:
          - generic [ref=e222]:
            - img [ref=e224]
            - text: VIP STEEL NEST
          - generic [ref=e227]:
            - heading "VIP Steel Nest — Ban Công Treo" [level=4] [ref=e228]
            - paragraph [ref=e229]: Yên Tĩnh & Độc Bản
            - paragraph [ref=e230]: Góc ban công container treo lơ lửng ngoài không gian, kiến tạo trải nghiệm lơ lửng độc bản giữa không trung. Phân khu biệt lập mang tính riêng tư cao, thích hợp cho các buổi gặp gỡ đối tác hay những cuộc trò chuyện sâu lắng.
            - generic [ref=e231]:
              - generic [ref=e232]:
                - generic [ref=e233]: Vị trí
                - generic [ref=e234]: Ban công container treo lửng
              - generic [ref=e235]:
                - generic [ref=e236]: Sức chứa
                - generic [ref=e237]: 10 khách
              - generic [ref=e238]:
                - generic [ref=e239]: Đặc điểm
                - generic [ref=e240]: Biệt lập & Yên tĩnh tuyệt đối
              - generic [ref=e241]:
                - generic [ref=e242]: Thiết kế
                - generic [ref=e243]: Thép công nghiệp xám & Kính
    - region "Chương trình thành viên cashback" [ref=e244]:
      - generic [ref=e245]:
        - generic [ref=e246]:
          - paragraph [ref=e247]: ⭐ CHƯƠNG TRÌNH THÀNH VIÊN
          - heading "Uống Là Có Lời — Cashback Lên Đến 8%" [level=2] [ref=e248]
          - paragraph [ref=e249]: Mỗi ly cà phê đều tích điểm và hoàn tiền vào ví. Càng uống càng lời — lên hạng để nhận thêm ưu đãi.
        - list [ref=e250]:
          - listitem [ref=e251]:
            - generic [ref=e252]: Silver
            - generic [ref=e253]: Thành viên mới
            - generic [ref=e254]: 0%
            - generic [ref=e255]: Cashback mỗi đơn
            - list [ref=e256]:
              - listitem [ref=e257]: ✓ Tích điểm ×1 mỗi đơn
              - listitem [ref=e258]: ✓ Hoàn tiền 2% vào ví
              - listitem [ref=e259]: ✓ Ưu đãi sinh nhật 10%
          - listitem [ref=e260]:
            - text: PHỔ BIẾN NHẤT
            - generic [ref=e261]: Gold
            - generic [ref=e262]: Từ 500 điểm
            - generic [ref=e263]: 0%
            - generic [ref=e264]: Cashback mỗi đơn
            - list [ref=e265]:
              - listitem [ref=e266]: ✓ Tích điểm ×1.5 mỗi đơn
              - listitem [ref=e267]: ✓ Hoàn tiền 5% vào ví
              - listitem [ref=e268]: ✓ Giảm 30% tháng sinh nhật
              - listitem [ref=e269]: ✓ Free upsize 1 lần/tuần
              - listitem [ref=e270]: ✓ Ưu tiên đặt bàn Rooftop
          - listitem [ref=e271]:
            - generic [ref=e272]: Platinum
            - generic [ref=e273]: Từ 1,000 điểm
            - generic [ref=e274]: 0%
            - generic [ref=e275]: Cashback mỗi đơn
            - list [ref=e276]:
              - listitem [ref=e277]: ✓ Tích điểm ×2 mỗi đơn
              - listitem [ref=e278]: ✓ Hoàn tiền 8% vào ví
              - listitem [ref=e279]: ✓ Giảm 50% + quà sinh nhật
              - listitem [ref=e280]: ✓ Free upsize không giới hạn
              - listitem [ref=e281]: ✓ Đặt bàn trước 48 giờ
              - listitem [ref=e282]: ✓ Mời sự kiện VIP exclusive
        - region "Máy tính cashback" [ref=e283]:
          - generic [ref=e284]:
            - text: 💰 Bạn chi
            - textbox "Số tiền chi tiêu hàng tháng" [ref=e285]: "500.000"
            - text: ₫/tháng
          - generic [ref=e286]:
            - generic [ref=e287]:
              - generic [ref=e288]: 🥉 Silver
              - generic [ref=e289]: 10.000₫
              - generic [ref=e290]: "/năm: 120.000₫"
            - generic [ref=e291]:
              - generic [ref=e292]: 🥇 Gold
              - generic [ref=e293]: 25.000₫
              - generic [ref=e294]: "/năm: 300.000₫ 🎉"
            - generic [ref=e295]:
              - generic [ref=e296]: 🏆 Platinum
              - generic [ref=e297]: 40.000₫
              - generic [ref=e298]: "/năm: 480.000₫"
        - generic [ref=e299]:
          - link "Đăng ký thành viên AURA CAFE miễn phí" [ref=e300] [cursor=pointer]:
            - /url: loyalty.html
            - text: Đăng Ký Thành Viên Miễn Phí →
          - paragraph [ref=e301]: Miễn phí đăng ký · Tích điểm ngay từ đơn đầu tiên · Cashback hoàn trong 24h
    - region "Câu chuyện AURA CAFE" [ref=e302]:
      - generic [ref=e304]:
        - generic [ref=e305]:
          - img [ref=e307]
          - heading "Sa Đéc" [level=3] [ref=e310]
          - paragraph [ref=e311]: Đồng Tháp, Vietnam
        - generic [ref=e312]:
          - paragraph [ref=e313]: CÂU CHUYỆN AURA CAFE
          - paragraph [ref=e314]: "Khởi đầu từ một ý tưởng táo bạo: biến container shipping thành không gian cà phê industrial-luxury độc đáo tại mặt phố Nguyễn Tất Thành, Sa Đéc. Chúng tôi kiến tạo nên một điểm đến đầy cảm hứng để cộng đồng gặp gỡ, sáng tạo và tận hưởng những ly specialty coffee tinh tuyển."
          - link "Khám phá thực đơn" [ref=e315] [cursor=pointer]:
            - /url: menu.html
            - text: Khám phá thực đơn →
    - region "Đặt bàn" [ref=e316]:
      - generic [ref=e318]:
        - paragraph [ref=e319]:
          - img [ref=e320]
          - text: SẴN SÀNG TRẢI NGHIỆM?
        - heading "Đặt Bàn Ngay Hôm Nay" [level=2] [ref=e324]
        - paragraph [ref=e325]: Rooftop hoàng hôn, cà phê specialty — tất cả trong một container.
        - generic [ref=e326]:
          - link "Đặt bàn ngay" [ref=e327] [cursor=pointer]:
            - /url: table-reservation.html
            - text: Đặt Bàn Ngay →
          - link "Xem menu" [ref=e328] [cursor=pointer]:
            - /url: menu.html
            - text: Xem Menu
        - list [ref=e329]:
          - listitem [ref=e330]:
            - img [ref=e331]
            - text: 27 Nguyễn Tất Thành, Phường 1
          - listitem [ref=e334]:
            - img [ref=e335]
            - text: "T2-T5: 07:00-22:00 | T6-CN: 06:00-23:00"
          - listitem [ref=e338]:
            - img [ref=e339]
            - text: 0946 013 633
  - contentinfo [ref=e341]:
    - contentinfo [ref=e342]:
      - generic [ref=e343]:
        - generic [ref=e344]:
          - generic [ref=e345]:
            - img "AURA CAFE" [ref=e346]
            - text: AURA CAFE
          - paragraph [ref=e347]: Where Flavor Meets Design
          - generic [ref=e348]:
            - link "Theo dõi AURA CAFE trên Facebook" [ref=e349] [cursor=pointer]:
              - /url: https://facebook.com/auracafesadec
              - img [ref=e350]
            - link "Theo dõi AURA CAFE trên Instagram" [ref=e352] [cursor=pointer]:
              - /url: https://instagram.com/auracafesadec
              - img [ref=e353]
            - link "Theo dõi AURA CAFE trên TikTok" [ref=e356] [cursor=pointer]:
              - /url: https://tiktok.com/@auracafesadec
              - img [ref=e357]
            - link "Liên hệ AURA CAFE qua Zalo" [ref=e359] [cursor=pointer]:
              - /url: https://zalo.me/0946013633
              - img [ref=e360]
        - generic [ref=e363]:
          - heading "Khám Phá" [level=5] [ref=e364]
          - link "Menu" [ref=e365] [cursor=pointer]:
            - /url: menu.html
          - link "Không Gian" [ref=e366] [cursor=pointer]:
            - /url: index.html#spaces
          - link "Đặt Bàn" [ref=e367] [cursor=pointer]:
            - /url: table-reservation.html
        - generic [ref=e368]:
          - heading "Thành Viên" [level=5] [ref=e369]
          - link "Loyalty & Cashback" [ref=e370] [cursor=pointer]:
            - /url: loyalty.html
          - link "Theo Dõi Đơn" [ref=e371] [cursor=pointer]:
            - /url: track-order.html
        - generic [ref=e372]:
          - heading "Hỗ Trợ & Admin" [level=5] [ref=e373]
          - link "Liên Hệ" [ref=e374] [cursor=pointer]:
            - /url: contact.html
          - link "About" [ref=e375] [cursor=pointer]:
            - /url: about-us.html
          - link "Admin Dashboard" [ref=e376] [cursor=pointer]:
            - /url: /admin/dashboard.html
          - link "KDS" [ref=e377] [cursor=pointer]:
            - /url: kds.html
      - generic [ref=e378]: © 2026 AURA CAFE · Sa Đéc, Đồng Tháp · fnbcontainer.vn v2.1.0
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