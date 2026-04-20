#!/usr/bin/env python3
"""
CTO Refactor Dispatcher — Giao task tự động cho Claude Code CLI qua TMUX.
Session: tom_hum | Window: fnb | Pane: 0
"""
import subprocess, time, sys

SESSION = "tom_hum"
PANE = f"{SESSION}:fnb.0"

tasks = [
    ("Phase 1: Xóa Bloat Files",
     'Đọc file plans/tasks/cto-refactor.md phần Phase 1. Xóa các file rác: export.pdf, lighthouse-report.html, websocket-server.js, task2.txt, task4.txt, test-reviews.html. Kiểm tra .cfignore và .gitignore đã có entry loại trừ. Thêm entry thiếu. Commit: "chore: remove dead files and update ignore rules"'),

    ("Phase 2: Dọn CSS rác",
     'Chạy grep kiểm tra xem các file CSS sau có còn HTML nào import không: css/loyalty-full.css, css/loyalty-m3.css, css/loyalty-styles.css, css/kds-m3.css, css/kds-styles.css. File nào KHÔNG có HTML nào tham chiếu thì xóa. Commit: "refactor: cleanup unused legacy css"'),

    ("Phase 3: Dọn JS cũ",
     'Kiểm tra js/websocket-client.js có HTML nào import không. Nếu không thì xóa. Trong js/config.js xóa block WS_CONFIG. Trong js/kds-app.js tìm và xóa mọi tham chiếu supabase cũ. Commit: "refactor: remove legacy websocket and supabase code"'),

    ("Phase 4: Gom Admin",
     'Tìm tất cả file .html và .js đang trỏ về "dashboard/admin" hoặc "dashboard/login". Đổi sang "admin/dashboard" và "admin/login". Sửa back-link trong admin/orders.html. Xóa thư mục dashboard/ cũ. Commit: "refactor: consolidate admin panel references"'),
]

def send(text):
    subprocess.run(["tmux", "send-keys", "-t", PANE, text, "Enter"])

def is_ready():
    r = subprocess.run(["tmux", "capture-pane", "-p", "-t", PANE, "-S", "-8"], capture_output=True, text=True)
    for line in reversed(r.stdout.strip().split('\n')):
        stripped = line.strip()
        if stripped.startswith('❯') and len(stripped) < 4:
            return True
    return False

def main():
    print("🚀 Dispatcher bắt đầu — 4 Phase Refactor")
    for i, (name, prompt) in enumerate(tasks):
        print(f"\n⏳ [{i+1}/{len(tasks)}] Đợi Worker sẵn sàng cho: {name}...")
        while not is_ready():
            time.sleep(3)
        print(f"⚡ Gửi: {name}")
        send(prompt)
        time.sleep(8)
        while not is_ready():
            time.sleep(5)
        print(f"✅ Xong: {name}")
        time.sleep(2)
    print("\n🔥 Hoàn tất 4 Phase Refactor!")

if __name__ == "__main__":
    main()
