# Phase 9: Primary Conversion Flow Audit (Task 9.1)

ĐỌC: `menu.html` và `js/menu.js`.

## Nhiệm vụ (Audit & Fix):
1. **Tiêm Shared Layout:** Trong `menu.html`, xoá mã cứng của Navbar/Footer. Tạo `<div id="shared-navbar"></div>` và `<div id="shared-footer"></div>` tương tự trang chủ. Call `loadSharedComponents()` trong file script nếu chưa có.
2. **Loại bỏ Hardcode Menu:** Trang bị chức năng fetch danh mục (`GET /api/categories`) và danh sách món (`GET /api/menu`) bằng cách xoá các nút `.category-btn` cứng đi (chỉ giữ mẫu) và xoá các `.menu-item` cứng trong `.menu-grid`.
3. **Cập nhật JS Fetch Logic:** Tại `js/menu.js` (hoặc tạo script inline ở cuối), viết hàm render động danh mục và danh sách món. Comment lại khối `fetch(API_BASE + '...')`.
4. **Fallback UI Mocks:** Cung cấp mảng hằng `MOCK_CATEGORIES` và `MOCK_PRODUCTS` để render dự phòng nếu fetch fail (để Local test không bị trắng trang). Gắn sự kiện filter danh mục cơ bản.

Kết thúc quá trình bằng câu `Done audit-menu-9.1`.
