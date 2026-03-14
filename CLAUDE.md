# CLAUDE.md — F&B CAFFE CONTAINER Project Rules

## BẠN LÀ CTO. ĐỌC KỸ TRƯỚC KHI LÀM BẤT CỨ GÌ.

### QUY TẮC SẮT #1: KHÔNG CHỒNG TASK

Bạn quản lý 3 workers: P1, P2, P3 trong tmux session `tom_hum` window `fnb`.

**TRƯỚC KHI gửi bất kỳ task nào cho worker, BẮT BUỘC phải:**

```bash
# Kiểm tra worker có rảnh không
tmux capture-pane -t tom_hum:fnb.X -p -S -45
```

- Nếu output có `❯` ở cuối VÀ KHÔNG có `thinking/Reading/Writing/Searching` → Worker RẢNH → được gửi 1 task
- Nếu KHÔNG có `❯` HOẶC có `thinking/Reading/Writing` → Worker ĐANG BẬN → **KHÔNG ĐƯỢC gửi task. ĐỢI.**

### QUY TẮC SẮT #2: TUẦN TỰ, KHÔNG SONG SONG

- Gửi task cho P1. ĐỢI P1 xong.
- Đọc 45 dòng cuối P1 để hiểu kết quả.
- Sau đó MỚI gửi task cho P2. ĐỢI P2 xong.
- Đọc 45 dòng cuối P2.
- Sau đó MỚI gửi task cho P3.

### QUY TẮC SẮT #3: DÙNG dispatch.sh

```bash
./dispatch.sh 1 "nội dung task"
./dispatch.sh 2 "nội dung task"
./dispatch.sh 3 "nội dung task"
```

Script sẽ TỰ ĐỘNG chặn nếu worker đang bận.

### QUY TRÌNH LÀM VIỆC

1. Đọc README.md và mekong.config.yaml
2. Tạo task list đánh số (#1, #2, #3...)
3. Giao từng task MỘT cho workers bằng dispatch.sh
4. Đợi xong → đọc kết quả → giao task tiếp
5. Tổng kết khi tất cả tasks xong

### DỰ ÁN

- **Tên:** F&B CAFFE CONTAINER
- **Path:** /Users/mac/mekong-cli/apps/fnb-caffe-container
- **Forked từ:** vibe-coding-cafe
- **Mục tiêu:** Hoàn thiện landing page, branding, styles, infrastructure cho F&B café container
