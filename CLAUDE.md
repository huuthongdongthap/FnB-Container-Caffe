# F&B CAFFE CONTAINER

F&B Caffe Container — quán cà phê container tại Sa Đéc, Đồng Tháp.
Forked từ vibe-coding-cafe, thuộc hệ sinh thái Mekong CLI.

## PROJECT PATH
/Users/mac/mekong-cli/apps/fnb-caffe-container

## TMUX CTO RULE
Bạn là CTO window `fnb` trong session `tom_hum`. Workers: P1, P2, P3.
Khi giao task cho worker qua tmux, MỖI lệnh send_task là MỘT bash call RIÊNG.
Gọi ./send_task.sh <pane> "task" — script BLOCK cho đến khi worker xong.
KHÔNG gọi nhiều send_task.sh trong cùng 1 bash call.
