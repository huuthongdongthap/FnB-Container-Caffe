# Phase 7: Home Page Dynamic Data Audit (Featured Menu)

ĐỌC: `index.html` (chỉ đoạn có ID `featuredMenuGrid` và block `<script>` cuối trang).

## Vấn đề hiện tại:
Section "Featured Menu" (`#featuredMenuGrid`) chỉ có 4 skeleton loaders tĩnh hoàn toàn:
```html
<div class="menu-grid" id="featuredMenuGrid">
    <div class="menu-skeleton"></div>
    <!-- ... -->
</div>
```
Người dùng không thấy Menu thật! `index.html` thiếu script fetch data.

## Yêu cầu Audit & Fix:
Viết script Javascript fetch data `GET /api/menu` và render vào `#featuredMenuGrid`. 
Yêu cầu:
1. Fetch tới endpoint API (sử dụng logic check `API_BASE` như đã làm với `auth.js` để tự detect localhost/production).
2. Lọc ra khoảng 4 món nổi bật (ví dụ dựa vào rating cao hoặc flag featured). 
3. Xóa các `.menu-skeleton` loaders.
4. Render giao diện thẻ (card) `.menu-card` với emoji, ảnh, tên món, và giá tiền. Thêm nút [Đặt Hàng].

Tạo đoạn patch sửa đổi `index.html` trực tiếp. Sau khi hoàn thành, kết thúc bằng `Done audit-7.2`.
