#!/bin/bash
# Idempotent webServer launcher for Playwright
# If port 5173 is already occupied, wait for it; otherwise start Vite
set -e
PORT=5173
URL="http://localhost:${PORT}"

if lsof -i:${PORT} >/dev/null 2>&1; then
  echo "[pw-server] Port ${PORT} already in use — waiting for server at ${URL}"
  until curl -sf "${URL}" >/dev/null 2>&1; do
    sleep 1
  done
  echo "[pw-server] Server already running, keeping process alive..."
  # Block forever so Playwright treats this as the webServer process
  # Actual server was started externally; tail a no-op file to stay alive
  while true; do sleep 60; done
else
  echo "[pw-server] Starting Vite dev server on ${PORT}"
  exec npm run dev -- --port ${PORT}
fi
