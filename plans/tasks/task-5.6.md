P0: Implement Order Status WS notifications.
ĐỌC: js/kds-app.js (phần update status 'Dang pha che' -> 'Hoan thanh') và nơi gọi PATCH /api/orders/:id/status.
Yêu cầu:
Khi Admin/KDS đổi trạng thái đơn hàng (gọi API PATCH thành công), BẮT BUỘC phải gửi sự kiện WebSocket loại 'update_order' đến websocket-server.js để người dùng đang theo dõi dơn hàng trên success.html nhận được thay đổi trạng thái realtime.
Nếu kds-app.js chưa có hook gọi ws.send -> FIX (bổ sung send update qua WS).
Làm xong hãy output "WS notifications E2E: OK".
