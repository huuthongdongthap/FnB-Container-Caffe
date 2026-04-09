# PROMPT THIẾT KẾ BRAND GUIDELINE (PENCIL.DEV)
Dành cho AI: Bạn là một Senior Brand Designer & Giám đốc Sáng tạo. Nhiệm vụ của bạn là sử dụng Pencil MCP để vẽ bộ Brand Guideline chuẩn xác cho AURA SPACE. Bối cảnh UI/UX: Elegant Luxury kết hợp Cyberpunk-Industrial, màu Black/Gold.

## Hãy tạo file `fnb-ui.pen` gồm 6 phần dưới đây bằng batch_design:

### SCREEN 01 — MASTER BRAND IDENTITIES
Thiết kế 3 cụm logo:
#### A. CONCEPT "CONTAINER HALO" MỚI (Icon nhận diện chính)
- Container 40ft nằm ngang (lớn nhất, phía dưới), 2 container 20ft xếp chéo phía trên tạo hình tam giác kiến trúc. Viền container stroke mảnh màu gold `#C9A200`, dạng hollow (rỗng).
- Hào quang (Halo): Đường viền phát sáng vàng lan rộng phía ngoài silhouette (~8px glow blur).
- Text bên dưới: `AURA SPACE` — Space Grotesk Bold, tracking 0.3em, uppercase, Gold.

#### B. MONOGRAM LOGO — "Golden A Monogram"
- Hình dạng: Chữ "A" hình học, bên trong chữ A có thanh ngang mỏng dạng container. Tô gradient vàng (`#C9A200` → `#FFD700` → `#B8860B`).
- Đường viền double-stroke industrial. Sử dụng như: favicon, thẻ thành viên.

#### C. ROOFTOP LOGO — "Sunrise Rooftop"
- Silhouette flat view mặt tiền cửa container 8.3m. Nửa vòng tròn bán nguyệt phát tia sáng radial từ dưới vươn lên.
- Text: `AURA SPACE` trên + `ROOFTOP CAFÉ · SA ĐÉC` dưới.

---

### SCREEN 02 — LOGO CLEAR SPACE & MISUSE RULES
- Trái (DO's): Logo trên nền đen, Monogram trên vật liệu đơn sắc, Logo Rooftop outdoor.
- Phải (DON'Ts): Các minh họa không được thu nhỏ méo tỷ lệ, không được dùng trên nền background rối. (Vẽ ô chéo đỏ đè lên lỗi kỹ thuật).

---

### SCREEN 03 — COLOR PALETTE
Thiết kế các layout swatches theo Grid sau:
- **Primary Colors:**
  `#0A0A0A` (Midnight Black), `#111111` (Aura Black), `#1A1A1A` (Container Steel), `#C9A200` (Master Gold), `#FFD700` (Electric Gold), `#B8860B` (Matte Gold)
- **Secondary Colors:**
  `#FFB300`, `#8B4513`, `#2C2C2C`, `#F5F5F5`, `#9E9E9E`
- **Gradient Presets:**
  - Gold Sunrise: `linear-gradient(90deg, #0A0A0A 0%, #C9A200 50%, #FFD700 100%)`
  - Halo Glow: `radial-gradient(circle, #FFD700 0%, #C9A200 40%, #0A0A0A 100%)`

*(Hiển thị các khối hộp gradient có padding)*

---

### SCREEN 04 — TYPOGRAPHY SYSTEM
- **Display / Hero**: `Space Grotesk`, 700, Gold, tracking +0.05em.
- **Headline H1/H2**: `Space Grotesk`, 600/500, White.
- **Body Text**: `Inter`, 400, 16-18px, Smoke Gray.
- **Code/Tag/Detail**: `JetBrains Mono`, 400, 14px, Neon Amber.

Làm mẫu một block test line hiển thị đủ Hierarchy từ H1 đến Caption. Thể hiện quy tắc không dùng font quá rối/uốn lượn.

---

### SCREEN 05 — ICONOGRAPHY & GRAPHIC ELEMENTS
Bộ 8 icon nhãn hiệu chuẩn Stroke nét 1.5px:
1. Container Stack (Xếp tầng)
2. Rooftop Umbrella (Mái vạt bạt nắng)
3. Coffee Cup Circuit (Ly cà phê mạch điện)
4. Tín hiệu Neon sấm sét / Tia điện
5. Mặt trời Sa Đéc.

Graphic Element:
- Chân trang đóng khung `[ ]` bằng stroke neon.
- Grid chấm bi điểm hạt (opacity 8%).

---

### SCREEN 06 — ÁNH XẠ THỰC TẾ (MOCKUPS VECTOR)
Vẽ 2 object ứng dụng sử dụng Flexbox/Grid của Pencil:
- **Card Member Metal Gold**: Card chữ nhật bo 12px, nền gradient xước thép tối màu, dập chìm `Golden A Monogram`, thông tin Membership dập JetBrains Mono vàng 14px.
- **Biển Hiệu Neon Demobox**: Khung rectangle đen sần (Metal box). Logo "Sunrise Rooftop" được gán stroke màu `Electric Gold`, kèm shadow lớp (layer shadows) để tạo Halo Phát sáng thực tế.