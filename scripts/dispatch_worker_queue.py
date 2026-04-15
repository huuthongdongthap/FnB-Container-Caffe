#!/usr/bin/env python3
import subprocess
import time
import sys

# The queue of tasks
tasks = {
  "checkout.html": "checkout",
  "table-reservation.html": "reservation",
  "contact.html": "contact",
  "loyalty.html": "loyalty",
  "track-order.html": "track",
  "about-us.html": "about"
}

def send_to_tmux(command):
    # Send the keystrokes to the pane
    subprocess.run(["tmux", "send-keys", "-t", "tom_hum:fnb.0", command, "C-m"])

def is_ready():
    # Capture the last few lines of the pane to check if we are at the prompt `> ` or `❯ `
    result = subprocess.run(["tmux", "capture-pane", "-p", "-t", "tom_hum:fnb.0", "-S", "-10"], capture_output=True, text=True)
    lines = result.stdout.strip().split('\n')
    for line in reversed(lines):
        if "❯" in line or "> " in line:
            # check if it's currently waiting (not typing)
            if "..." not in line and "Effecting" not in line and "Frolicking" not in line:
                return True
    return False

def main():
    print("🚀 Bắt đầu tuần tự giao 6 tasks cho Worker qua TMUX...")
    for file, key in tasks.items():
        print(f"⏳ Cần chia nhỏ task cho {file}...")
        
        # Wait until CLI is ready
        while not is_ready():
            time.sleep(2)
            
        print(f"⚡ Đang giao Dispatch lệnh xử lý cho file {file}...")
        
        prompt = f"Thay thế navbar và footer tĩnh thành <div id='shared-navbar'></div> và <div id='shared-footer'></div> cho file {file}. Chỉ sửa file này thôi! Import module ./js/shared-nav.js và gọi initNavbar('{key}') rồi initFooter(). KHÔNG sửa hay xóa nội dung thẻ body, KHÔNG xóa css inline."
        send_to_tmux(prompt)
        
        # small delay so prompt goes away
        time.sleep(10)
        
        # wait for it to finish and return to prompt
        while not is_ready():
            time.sleep(5)
            
        print(f"✅ Worker đã hoàn thành file {file}!")
        time.sleep(2) # breathing room
        
    print("🔥 Hoàn tất toàn bộ 6 files được chia nhỏ!")

if __name__ == "__main__":
    main()
