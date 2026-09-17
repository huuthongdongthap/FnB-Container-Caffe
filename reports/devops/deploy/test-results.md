# Smoke Test Results — 2026-09-11

| Endpoint | Expected | Actual | Status |
|----------|----------|--------|--------|
| FE https://5b9e8842.fnb-caffe-container.pages.dev | HTTP 200 | 200 | ✅ |
| BE https://aura-space-worker...workers.dev/health | JSON response | `{"success":false,"error":"Unauthorized — vui lòng đăng nhập"}` | ✅ (auth gate working) |

## Unit/Integration (pre-deploy)
- Frontend: 357 test files / 3249 tests — all passed
- Worker: 151 test files / 1551 tests — all passed
