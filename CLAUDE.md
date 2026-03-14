# F&B CAFFE CONTAINER

## PROJECT
- Path: /Users/mac/mekong-cli/apps/fnb-caffe-container
- Forked từ vibe-coding-cafe
- F&B café container tại Sa Đéc, Đồng Tháp

## CTO TMUX DISPATCH RULE — ĐỌC KỸ

Bạn quản lý workers P1, P2, P3 trong tmux `tom_hum:fnb`.

### BẮT BUỘC: Mỗi send_task là 1 bash call riêng

**ĐÚNG — mỗi lệnh là 1 tool call Bash riêng biệt:**
```bash
# Tool call 1:
./send_task.sh 1 "task cho P1"
```
Đợi kết quả trả về, rồi:
```bash
# Tool call 2:
./send_task.sh 2 "task cho P2"
```

**SAI — KHÔNG BAO GIỜ gộp nhiều lệnh:**
```bash
# ❌ SAI:
./send_task.sh 1 "task" && ./send_task.sh 2 "task"
# ❌ SAI:
tmux send-keys -t ... && tmux send-keys -t ...
```

### CẤM
- ❌ tmux send-keys trực tiếp
- ❌ Nhiều send_task trong 1 bash call
- ❌ Giao task mới khi send_task chưa return
