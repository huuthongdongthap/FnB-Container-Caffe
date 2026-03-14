#!/bin/zsh
# dispatch.sh — Safe task dispatcher: KHÔNG chồng task
# Usage: ./dispatch.sh <pane> "task message"
# Example: ./dispatch.sh 1 "Review index.html"

SESSION="tom_hum"
WINDOW="fnb"
PANE="$1"
TASK="$2"

if [[ -z "$PANE" || -z "$TASK" ]]; then
  echo "❌ Usage: ./dispatch.sh <pane_number> \"task message\""
  exit 1
fi

TARGET="${SESSION}:${WINDOW}.${PANE}"

# BUOC 1: Doc 45 dong cuoi
echo "🔍 Checking P${PANE} status..."
OUTPUT=$(tmux capture-pane -t "$TARGET" -p -S -45 2>/dev/null)

if [[ -z "$OUTPUT" ]]; then
  echo "❌ P${PANE} not found or dead"
  exit 1
fi

# BUOC 2: Kiem tra co dau nhay ❯ khong
if echo "$OUTPUT" | grep -q "❯"; then
  # Kiem tra them: dang thinking/running khong?
  if echo "$OUTPUT" | tail -5 | grep -qE "thinking|Cogitat|Reading|Writing|Editing|Searching|running"; then
    echo "⏳ P${PANE} dang BAN (thinking/running). DOI."
    echo "--- Last 5 lines ---"
    echo "$OUTPUT" | tail -5
    exit 2
  fi
  
  echo "✅ P${PANE} RANH. Gui task..."
  tmux send-keys -t "$TARGET" C-u 2>/dev/null
  sleep 0.3
  tmux send-keys -t "$TARGET" -l "$TASK"
  sleep 0.5
  tmux send-keys -t "$TARGET" Enter
  echo "📨 Task sent to P${PANE}: $TASK"
else
  echo "⏳ P${PANE} dang BAN (khong co ❯). DOI."
  echo "--- Last 5 lines ---"
  echo "$OUTPUT" | tail -5
  exit 2
fi
