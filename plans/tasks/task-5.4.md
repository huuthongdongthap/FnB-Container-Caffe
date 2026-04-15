P0: Verify Table Status Sync (tables.js, table-reservation.html).
ĐỌC: worker/src/routes/tables.js và worker/src/index.js để kiểm tra router.
ĐỌC: table-reservation.html để xem phần ZONES hardcode.
Kiểm tra: 
1. worker/src/index.js có đăng ký tablesRouter vào /api/tables chưa? Nếu chưa -> FIX.
2. table-reservation.html đang hardcode ZONES. Cần móc fetch('/api/tables') để load danh sách bàn, sau đó map lại vào ZONES và gọi renderTables().
Nếu có gap -> FIX, ghi comment "// FIX: P0 table sync".
Làm xong hãy output "Table Status Sync E2E: OK".
