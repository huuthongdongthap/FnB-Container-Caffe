#!/usr/bin/env python3
"""
Cook ALL Tasks — Dispatch toàn bộ task files → CTO Worker qua TMUX.
Session: tom_hum | Window: fnb | Pane: 0
"""
import subprocess, time, glob, os

SESSION = "tom_hum"
PANE = f"{SESSION}:fnb.0"
TASKS_DIR = os.path.expanduser("~/mekong-cli/FnB-Container-Caffe/plans/tasks")

# Skip cto-refactor (already done)
SKIP = {"cto-refactor.md"}

def send(text):
    subprocess.run(["tmux", "send-keys", "-t", PANE, text, "Enter"])

def is_ready():
    r = subprocess.run(["tmux", "capture-pane", "-p", "-t", PANE, "-S", "-5"],
                       capture_output=True, text=True)
    for line in reversed(r.stdout.strip().split('\n')):
        s = line.strip()
        if s == '❯' or (s.startswith('❯') and len(s) < 4):
            return True
    return False

def main():
    files = sorted(glob.glob(f"{TASKS_DIR}/*.md"))
    files = [f for f in files if os.path.basename(f) not in SKIP]
    
    print(f"🍳 Cook ALL — {len(files)} tasks to dispatch")
    
    for i, fpath in enumerate(files):
        name = os.path.basename(fpath)
        content = open(fpath).read().strip().replace('\n', ' ')
        # Truncate to 500 chars to avoid TMUX buffer overflow
        if len(content) > 500:
            content = content[:500] + "..."
        
        print(f"\n⏳ [{i+1}/{len(files)}] Đợi Worker cho: {name}")
        while not is_ready():
            time.sleep(3)
        
        prompt = f"Thực hiện task từ file plans/tasks/{name}. Đọc file đó và làm theo chỉ dẫn. Commit khi xong."
        print(f"⚡ Gửi: {name}")
        send(prompt)
        time.sleep(5)
        
        while not is_ready():
            time.sleep(5)
        
        print(f"✅ Xong: {name}")
        time.sleep(2)
    
    print(f"\n🔥 Hoàn tất toàn bộ {len(files)} tasks!")

if __name__ == "__main__":
    main()
