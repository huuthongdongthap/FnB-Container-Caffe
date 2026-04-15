Edit table-reservation.html.
Yêu cầu:
1. Hiện tại biến ZONES chứa data hardcode. Hãy sửa để giữ cấu trúc mảng rỗng ban đầu, ví dụ { rooftop: {title:'...', tables:[], rows:[...], rowEls:[...]}, ... }.
2. Viết thêm `async function loadTables()` để fetch('/api/tables').
3. Map kết quả fetch được vào mảng `tables` của từng Zone trong biến ZONES tương ứng (gắn id và css class: 'avail', 'booked', hoặc 'selected').
4. Gọi hàm loadTables() khi trang load, rồi sau đó mới renderTables() và updateBar().
Note: Không cần dùng /bash, hãy dùng tính năng edit file trực tiếp. Trả lời "Done 5.4b" khi hoàn tất.
