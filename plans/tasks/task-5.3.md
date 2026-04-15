P0: Verify KDS Real-time Integration.
ĐỌC: js/kds-app.js (cách nhận order mới), js/kds-poll.js (polling mechanism), websocket-server.js (WS message format), js/websocket-client.js (client WS handler).

Kiểm tra: Khi Worker tạo order mới → có push event tới KDS không? WebSocket message format có match giữa server và client không?

Nếu có gap → FIX (thêm WS emit trong order creation route). Nếu OK → báo cáo "KDS real-time: OK".
