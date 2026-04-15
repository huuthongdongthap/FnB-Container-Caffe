# Báo Cáo Tích Hợp: Autonomous Execution Pipeline (Qwen 3.6 Plus)

**Dự án:** FnB-Container-Caffe
**Thời gian:** Tháng 4/2026
**LLM Worker:** Qwen 3.6 Plus (thông qua Alibaba DashScope API & Claude Code CLI)
**Nguyên tắc vận hành:** Ủy quyền hoàn toàn qua TMUX (Quy tắc "ko dc code truc tiep")

---

## 1. Kiến Trúc Pipeline Giao Tiếp

Hệ thống được thiết kế để Antigravity (CTO Brain) có thể chỉ đạo một Worker tự trị (Qwen 3.6 Plus) làm nhiệm vụ dọc theo toàn bộ vòng đời của dự án, bỏ qua các rào cản thao tác tay.

```text
┌──────────────┐    ┌─────────────────────┐    ┌────────────────────┐
│  CTO Brain   │───▶│  Claude Code CLI     │───▶│  Qwen 3.6 Plus     │
│ (Antigravity)│    │  CLAUDE_CONFIG_DIR   │    │  via DashScope API │
│              │    │  ~/.claude-dashscope │    │  coding-intl       │
└──────────────┘    └─────────────────────┘    └────────────────────┘
       │                     │
       ▼                     ▼
  send_task.sh         CLAUDE.md protocol
  (tmux pane)          (zero-chatbot, chunk-edit)
```

**Các thiết lập chính:**
- **Profile Cloud:** Dùng cấu hình riêng tại `~/.claude-dashscope/settings.json` trỏ api `sk-sp-*` về endpoint `coding-intl.dashscope.aliyuncs.com`.
- **TMUX Proxy:** Worker chạy ngầm trong tmux session `tom_hum`. Antigravity gửi lệnh bằng script `./send_task.sh 0 "$(cat plans/tasks/task-X.md)"`.
- **Safety Bypass:** Cờ `--dangerously-skip-permissions` bật chế độ chạy lệnh và sửa file xuyên suốt không cần xác nhận.

---

## 2. Lịch Sử Triển Khai (Phase 4 & Phase 5)

Dưới sự chỉ đạo của CTO Brain, Qwen Worker đã hoàn thành các module Full-stack từ D1 SQLite (Backend) tới UI tương tác (Frontend):

### Phase 4: Thiết lập Cloudflare Worker & D1 Database
1. **Schema D1 (`schema.sql`):** Tự động tạo và migrate các table `contact_messages`, `reviews`, `loyalty_members`, `loyalty_history`, `loyalty_tiers`.
2. **API Endpoints:** Hoàn tất việc code các router API `/api/reviews`, `/api/contact`, và `/api/loyalty` (hỗ trợ read/write như register, cashback, redeem).
3. **Database Seeder (`seed.sql`):** Tự động populate dummy data cho các bảng để phục vụ testing.

### Phase 5: Frontend API Integration & Real-time WS
1. **D1 Validation:** Ánh xạ lại schema order payload từ E2E checkout web-flow xuống Cloudflare D1.
2. **KDS Thực Thời:** Thiết lập cơ chế KV polling dựa vào trigger `AUTH_KV`, giúp KDS tự động làm mới giao diện khi có thay đổi trạng thái đơn.
3. **Đồng Bộ Trạng Thái Bàn:** Loại bỏ dữ liệu Zones/Tables hardcode trong `table-reservation.html`, Fetch dữ liệu động qua `/api/tables`, sau đó thực thi JS patch để populate bảng theo ID.
4. **Auto-Cashback Trigger:** Tự động gọi hàm tính điểm cashback cập nhật vào `loyalty_members` mỗi khi trạng thái đơn hàng (qua KDS hoặc Webhook) chuyển thành `"delivered" / "Hoan thanh"`.
5. **WebSocket Customer Tracking:** Đảm bảo `kds-app.js` gửi đi WS notification loại `update_order` cho máy chủ websocket, thông báo realtime để route Tracking App bắt được thay đổi ngay lập tức.

---

## 3. Tổng Kết
Việc uỷ thác 100% cho Qwen đã được hiện thực hóa qua *Continuous Orchestration*. Pipeline hiện tại đã rất vững, có thể tận dụng tiếp cho mọi task audit, feature extension, hoặc debug trong hệ thống FnB này về sau.
