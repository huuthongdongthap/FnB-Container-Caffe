# Kế Hoạch Điều Chỉnh Thiết Kế fnb-ui.pen (Max Level 100X)

Dựa trên bản thiết kế hiện tại (`fnb-ui.pen`) và tài liệu `pencil-brand-prompts.md`, hệ thống đang sử dụng concept logo cũ. Với quyết định chuyển sang **Logo V2F (Corrugated A + Zen Coffee Swirl)** và thương hiệu **AURA SPACE**, đây là kế hoạch điều chỉnh toàn diện cho bản thiết kế `.pen`:

## 1. Cập Nhật Brand Guideline (Screens 01 - 08)

### Thay đổi Logo System (Screen 01, 06)
- **Xóa bỏ:** Các concept logo cũ (Container Halo, 3 box chữ nhật).
- **Cập nhật Hệ Thống Logo 3 Tầng:**
  1. **Primary Icon (V2F):** Hình chữ "A" bằng vách tôn gợn sóng + tâm espresso "Zen Swirl". Dùng cho Favicon, Avatar MXH, Stamp.
  2. **Wordmark:** Cụm typography "AURA SPACE" (Space Grotesk hoặc Playfair Bold, giãn cách chữ lớn). Dùng cho bảng hiệu LED neon chính.
  3. **Hero Scene (Option C):** Khung cảnh 2 block container xếp chồng với đèn dây hoàng hôn. Dùng làm hình ảnh bao bì, túi giấy, banner cỡ lớn.
- **Quy tắc sử dụng (Do's & Don'ts):** Bổ sung quy định về độ dày tối thiểu của đường vân sóng tôn và nét Zen Swirl khi cắt CNC/Laser.

### Typography & Màu Sắc (Screen 02, 03)
- **Tên thương hiệu:** Thay thế dứt điểm toàn bộ placeholder "F&B Container" thành **AURA SPACE**.
- **Font chữ:** Áp dụng hệ thống 3 font: `Cormorant Garamond` (Hero/Luxury), `Space Grotesk` (Labels/Tech), `Inter` (Body).
- **Màu sắc:** Nhấn mạnh mã màu `Dark Mode #0A0A0A` và `Accent Gold #C9A962`.

## 2. Nâng Cấp Phối Cảnh Thực Tế & Web UI (Screens 09 - 15)

### KIỂM SOÁT NGHIÊM NGẶT DỮ LIỆU THI CÔNG (REAL-WORLD CONSTRAINTS)
Để đảm bảo các mockup 3D và bản vẽ trong file `.pen` bám sát bản vẽ kỹ thuật (MẶT BẰNG TRỆT & MẶT BẰNG GÁC) 8.3m x 23m, cấu trúc không gian PHẢI tuân thủ:

1. **Tầng Trệt (Ground Floor):**
   - **Bên trái (Dọc theo vách):** Bắt đầu ngay từ ranh đất mặt tiền là **Container 40ft (dài 12.3m)** chạy dọc sát tường tiếp khách. Nối tiếp theo là **Cầu thang (2.4m)**. Phía sau cầu thang là **Container 20ft (6m)** làm Quầy Bar.
   - **Bên phải:** Từ mặt tiền vào là một **Khoảng sân trống siêu rộng (dài 14.7m)** dùng làm bãi đỗ xe và sân ngoài trời. Phía sau khoảng sân này là **Container 20ft (6m)** đặt song song với Quầy Bar.
   - **Mặt cắt kính và Vách rỗng (Facades & Openings):** 
     - **Cont 40ft:** Mặt ngang quay ra đường (2.4m) là full kính cường lực. Ở mặt hông (12.3m quay ra sân), **chỉ cắt kính khoảng 2/3 chiều dài**, phần còn lại giữ vách thép, và **cửa kính đi vào nằm ở vị trí cuối container** (gần cầu thang).
     - **Cont 20ft:** Các mặt hướng ra sân đều khoét lắp kính. ĐẶC BIỆT: **Hai vách của 2 container 20ft đối diện nhau dọc theo lối đi giữa đã được CẮT RỖNG HOÀN TOÀN**. 
   - **Lối đi trung tâm:** Phần hở nằm giữa 2 cont 20ft phía sau là **lối hành lang mở chạy thẳng** ra khu WC cuối đất. Nhờ việc 2 vách cont đối diện bị cắt rỗng, nên từ ngoài sân nhìn thẳng vào lối đi này có thể **thấy xuyên suốt** không gian bên trong Quầy bar (trái) và Cont 20ft còn lại (phải).
   - **Khu vực cuối ranh (2.3m chót):** Bố trí WC Nam/Nữ (bên trái) và Kho (bên phải), xây gạch độc lập.

2. **Mặt tiền chính (8.3m):** 
   - Đầu lộ chính sẽ thấy **tiết diện hông 2.4m của Container 40ft** bên trái và **khoảng sân trống dài 14.7m** bên phải.
   - Bảng hiệu "AURA SPACE" LED giăng ngang lối vào (đầu lộ).

2. **Tầng Gác (Mezzanine/Rooftop):**
   - **Khối Phòng Lạnh (Phía sau):** Trên nóc 2 cont 20ft phía sau là một **phòng kín vách kính cường lực** rộng tràn toàn bộ chiều ngang lô đất (8.3m x 6m). Đây là điểm nhấn kiến trúc lớn nhìn từ phía trước. Không gian này cần chú ý đúng chuẩn tỷ lệ lớn (8.3 x 6m).
   - **Đặc trưng Cont 20ft phía dưới:** Hai container 20ft ở tầng trệt (đỡ phòng lạnh) được **cắt bỏ 2 vách liền kề** để thông suốt, tạo thành một không gian rộng rãi (quầy bar/khu vực chung).
   - **Sân Thượng / Rooftop (Phía trước bên trái):** Là một sàn lót Cemboard lợp trên nóc Cont 40ft, kích thước hẹp dài (12.3m x 2.4m). **Chỉ bố trí chỗ ngồi**, tuyệt đối không có công năng phụ khác. 
   - **Chi tiết kết cấu Rooftop:** Khi lên phối cảnh hoặc vẽ UI liên quan, phải thể hiện rõ:
     - **Lan can:** Chạy dọc suốt chiều dài 12.3m, bảo đảm an toàn.
     - **Mái che:** Hệ thống bạt che nắng/mưa mờ (HDPE) trên đầu.
     - **Tầm nhìn xuống dưới:** Đứng từ lan can rooftop nhìn trực tiếp xuống khoảng sân trống bên phải (tầng trệt). Không vẽ tầm nhìn hư cấu xuyên thấu vào trong quầy bar.
   - Cầu thang nằm ở khoảng nối ranh giới giữa sân thượng ngoài trời và khối phòng kính.

### Cập Nhật Phối Cảnh Bản Vẽ (Screens 09, 10, 11)
- **Screen 09 (Facade Night View):** Nhìn từ ngoài đường vào phải thấy rõ chiều sâu: bên trái là khối cont 40ft kéo dài, sân bên phải trống. Nhìn hất lên phía sau (trên gác) sẽ thấy một **khối phòng kính rực sáng** vắt ngang lô đất 8.3m. Nổi bật trên tầng 2 bên trái là dải lan can rooftop dài 12m.
- **Screen 10 (Rooftop / Mezzanine):** Phối cảnh dọc theo sàn Cemboard 12.3x2.4m (chỉ có bàn ghế), bên cạnh là dải lan can nhìn trọn xuống sân trống bên phải. Mái bạt che nhám tĩnh ở trên đầu. Tầm nhìn hất về phía khối phòng kính ở cuối.
- **Screen 11 (Bar/Interior):** Không gian quầy bar (tầng trệt, nằm bên dưới phòng kính) được thông dầm cực rộng nhờ **cắt 2 vách liền kề** của 2 cont 20ft. Hướng tầm nhìn ra sân mở. Khắc laser icon logo **V2F** ở lưng quầy.

### Bổ Sung Phối Cảnh Web UI (New Screens 13, 14, 15)
Chèn thẳng 3 bản thiết kế Web UI (sử dụng icon V2F) vào file `fnb-ui.pen` để làm Master Reference cho Developer:
- **Screen 13: Homepage Hero (Night Mode)** - Landing page đen tuyền chứa background ảnh chụp 3D facade *đúng cấu trúc mặt tiền 8.3m*. Navbar glassmorphism trong suốt (chứa logo V2F). Nút CTA Glow viền vàng.
- **Screen 14: Digital Menu Application** - Thẻ sản phẩm (Product cards) thiết kế kiểu thẻ bài kim loại, bo góc nhẹ, đổ bóng viền vàng cyber. Cột mini-cart bên phải. Dùng V2F cho placeholder ảnh nứt/loading.
- **Screen 15: KDS Terminal Dashboard** - Giao diện cho nhân viên bếp (quầy bar Cont 20ft), màn hình Kanban 3 cột phong cách Hacker Terminal. Gắn logo V2F nhỏ ở góc header.

## 3. Thực Thi (Execution Plan)
1. Cấu hình lại file `pencil-brand-prompts.md` với các hướng dẫn cập nhật như trên.
2. Dùng Pencil.dev dán đè các prompt mới để gen đè lên các components cũ trong file `fnb-ui.pen`.
3. Verify giao diện thực tế với Developer bằng ảnh chụp màn hình MCP.
