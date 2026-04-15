File: `js/shared-nav.js`
Đọc file hiện có. CHỈ SỬA phần navbar links:
1. Đảm bảo ĐẦY ĐỦ links: Trang Chủ (index.html), Menu (menu.html), Không Gian (index.html#spaces), Đặt Bàn (table-reservation.html), Loyalty (loyalty.html), Liên Hệ (contact.html), CTA "Đặt Bàn" (table-reservation.html)
2. Thêm link "Loyalty" (loyalty.html) nếu chưa có
3. Active page: thêm class `.nav-active` vào link tương ứng (gold color + underline)
4. Mobile drawer: đảm bảo có Track Order (track-order.html) + About (about-us.html) links

RULES:
- KHÔNG viết lại toàn bộ file. Chỉ edit chunk cần sửa.
- Giữ nguyên CSS variables hiện có
- Hamburger menu phải hoạt động
- Scroll effect (transparent → solid) phải hoạt động
