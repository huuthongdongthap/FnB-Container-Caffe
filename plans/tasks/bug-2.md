Fix hardcoded `localhost:8000` API_BASE trong checkout và KDS.

ĐỌC: `js/checkout.js` (line 54) và `js/kds-app.js` (line 24).

## Yêu cầu:

### 1. `js/checkout.js` line 54
Thay:
```js
const API_BASE = 'http://localhost:8000/api';
```
Bằng:
```js
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8787/api'
  : 'https://aura-space-worker.sadec-marketing-hub.workers.dev/api';
```

### 2. `js/kds-app.js` line 24
Thay:
```js
API_BASE: 'http://localhost:8000/api',
```
Bằng:
```js
API_BASE: window.location.hostname === 'localhost'
  ? 'http://localhost:8787/api'
  : 'https://aura-space-worker.sadec-marketing-hub.workers.dev/api',
```

> Lưu ý: Wrangler dev chạy port 8787, KHÔNG phải 8000.

Hoàn tất → trả lời "Done bug-2".
