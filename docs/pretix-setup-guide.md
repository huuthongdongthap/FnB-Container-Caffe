# 🎫 pretix Event Ticketing — Setup Guide / Hướng Dẫn Cai Đặt

**Aura Cafe — Workshop & Event Ticket Sales**

---

## 📋 Mục Lục / Table of Contents

1. [Docker Deployment / Triển Khai Docker](#1-docker-deployment)
2. [Organizer + Event Setup / Tạo Organizer va Event](#2-organizer--event-setup)
3. [API Token + Worker Config / Cấu Hinh API Token](#3-api-token--worker-config)
4. [Widget Embed / Nhúng Widget Len Website](#4-widget-embed)
5. [Check-in Scanner / May Quet Ve Cổng](#5-check-in-scanner)
6. [Troubleshooting / Xử Lý Lỗi](#6-troubleshooting)

---

## 1. 🐳 Docker Deployment / Triển Khai Docker

### 1.1 Yeu cầu / Prerequisites

- Docker + docker-compose
- 2GB+ RAM, 10GB disk
- Domain tro den VPS (vi dụ: `tickets.auraspace.cafe`)
- Nginx reverse proxy (recommended)

### 1.2 Cai đặt / Installation

```bash
# Tao thư mục pretix / Create directory
mkdir -p /opt/pretix && cd /opt/pretix

# Copy docker-compose file từ docs/
cp docs/docker-compose.pretix.yml /opt/pretix/docker-compose.yml

# Copy file cấu hinh pretix
cp docs/pretix.cfg /opt/pretix/pretix.cfg

# Sửa cấu hinh / Edit config
nano pretix.cfg
# - Đổi database password (dòng [database] password=)
# - Đổi SMTP email config (dòng [mail])
# - Đổi instance_name thành "Aura Cafe Tickets"

# Khoi động / Start
PRETIX_DB_PASSWORD=your-secure-password docker-compose up -d

# Chạy migrations (lần đầu) / Run first-time migrations
docker exec pretix_app python -m pretix migrate

# Tạo admin user / Create admin
docker exec -it pretix_app python -m pretix createuser --email admin@auraspace.cafe
```

### 1.3 Nginx Reverse Proxy

```nginx
server {
    server_name tickets.auraspace.cafe;

    location / {
        proxy_pass http://127.0.0.1:9001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
certbot --nginx -d tickets.auraspace.cafe
```

---

## 2. 🏗️ Organizer + Event Setup / Tạo Organizer va Event

### 2.1 Tạo Organizer / Create Organizer

1. Đang nhập pretix admin: `https://tickets.auraspace.cafe/control/`
2. Vao **Organizers** → **Create new organizer**
3. Điền / Fill:
   - **Name:** `Aura Cafe`
   - **Slug:** `aura-cafe`

### 2.2 Tạo Event Đầu Tien / Create First Event

1. Vao organizer **Aura Cafe** → **Create new event**
2. Điền / Fill:
   - **Name:** `Workshop Thang 7 — Latte Art` (nhập cả VN + EN)
   - **Slug:** `workshop-thang-7`
   - **Date from/to:** Ngay + giờ diễn ra
   - **Currency:** VND
   - **Presale end:** Trước ngay diễn ra 1 ngay
3. Bấm **Create event**

### 2.3 Tạo Loại Ve / Create Ticket Types

Trong event → **Products** → **Create product**:

| Name | Price (VND) | Quota | Mô tả |
|------|-------------|-------|-------|
| Ve Thường / Standard | 150,000 | 20 | Vao cổng + 1 đồ uống |
| Ve VIP / VIP | 350,000 | 10 | Vao cổng + đồ uống + ngồi hang đầu |

### 2.4 Cấu Hinh Thanh Toan / Configure Payment

Vao **Settings** → **Payment**:
- Enable **Bank transfer** (manual) — free
- Enable **Cash at door** if muốn
- VNPay plugin (nếu có) — paid plugin, optional

---

## 3. 🔑 API Token + Worker Config / Cấu Hinh API Token

### 3.1 Tạo API Token / Generate API Token

1. Vao pretix admin: **User** (góc tren phải) → **API tokens**
2. Bấm **Create new token**
3. Điền / Fill:
   - **Name:** `aura-worker-bridge`
4. Copy token (dạng `1|abc123...`)

### 3.2 Thêm Env Vars / Add to Cloudflare Worker

```toml
# worker/wrangler.toml
[vars]
PRETIX_API_URL = "https://tickets.auraspace.cafe"
PRETIX_API_TOKEN = "1|abc123def456..."
PRETIX_ORGANIZER = "aura-cafe"
PRETIX_WEBHOOK_SECRET = "whsec_random_32_character_secret_key"
```

Hoặc thêm tren Cloudflare Dashboard:
- **Workers & Pages → aura-worker → Settings → Variables**
- Thêm 4 biến / Add 4 variables như tren

### 3.3 Kiểm Tra / Test Connection

```bash
curl https://fnb-caffe-container.pages.dev/api/pretix/events
```

**Kết quả mong đợi / Expected:**
```json
{
  "success": true,
  "data": {
    "count": 1,
    "results": [{ "slug": "workshop-thang-7", "name": "Workshop Tháng 7 — Latte Art", ... }]
  }
}
```

---

## 4. 🎨 Widget Embed / Nhúng Widget Len Website

### 4.1 Cach 1: Widget đầy đủ / Full Widget

Copy code nay vao `/workshops` page:

```html
<link rel="stylesheet" href="https://tickets.auraspace.cafe/aura-cafe/workshop-thang-7/widget/v2.css" crossorigin>
<script src="https://tickets.auraspace.cafe/widget/v2.en.js" async crossorigin></script>
<pretix-widget event="https://tickets.auraspace.cafe/aura-cafe/workshop-thang-7/"></pretix-widget>
```

### 4.2 Cach 2: Nut "Mua Ve" đơn giản / Buy Button

```html
<pretix-button event="https://tickets.auraspace.cafe/aura-cafe/workshop-thang-7/" items="item_1=1">
  🎫 Mua Vé / Buy Ticket
</pretix-button>
<script src="https://tickets.auraspace.cafe/widget/v2.en.js" async crossorigin></script>
```

### 4.3 Tuy chỉnh CSS / Custom CSS

```css
pretix-widget {
  --pretix-primary-color: #8B4513;    /* Aura Cafe brown */
  --pretix-font-family: 'Inter', sans-serif;
  max-width: 800px;
  margin: 0 auto;
}
```

---

## 5. 📱 Check-in Scanner / May Quet Ve Cổng

### 5.1 API Check-in

```
POST /api/pretix/checkin
Body: { "secret": "<ticket-secret-from-qr>", "event": "workshop-thang-7", "listId": 1 }
Response: { "success": true, "data": { "status": "ok" } }
```

**Status codes:**
- `ok` — Ve hợp lệ, check-in lần đầu / Valid, first check-in ✅
- `error` + `reason: "already_redeemed"` — Ve đa check-in rồi / Already scanned ⚠️
- `404` — Ve khong hợp lệ / Invalid ticket ❌

### 5.2 Web Check-in Page đơn giản / Simple Scanner

Tạo file HTML tren diện thoại / Create a mobile-friendly check-in page:

```html
<!DOCTYPE html>
<html>
<head><title>Check-in Aura Cafe</title></head>
<body>
  <h1>🎫 Aura Cafe Check-in</h1>
  <input id="secret" placeholder="Quet QR hoặc nhập ma ve..." autofocus>
  <div id="result"></div>
  <script>
    document.getElementById('secret').addEventListener('change', async (e) => {
      const res = await fetch('/api/pretix/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: e.target.value, event: 'workshop-thang-7' })
      });
      const data = await res.json();
      const el = document.getElementById('result');
      if (data.data?.status === 'ok') el.innerHTML = '✅ Check-in thanh cong!';
      else if (data.data?.reason === 'already_redeemed') el.innerHTML = '⚠️ Ve đa được dùng rồi!';
      else el.innerHTML = '❌ Ve khong hợp lệ!';
      e.target.value = '';
    });
  </script>
</body>
</html>
```

---

## 6. 🔧 Troubleshooting / Xử Lý Lỗi

| Vấn đề / Issue | Giai phap / Solution |
|---------------|---------------------|
| pretix khong start được | Kiểm tra port 9001 co bị chiem khong. `docker logs pretix_app` |
| API returns 401 | Token hết hạn → tạo token mới trong pretix admin UI |
| Webhook khong nhận được | Kiểm tra nginx co proxy đung khong. Verify `PRETIX_WEBHOOK_SECRET` khớp |
| Widget khong hiển thị | Kiểm tra CORS. Đảm bảo pretix URL HTTPS. Kiểm tra console log |
| Khong thấy event | Event chưa được set "live" → vao pretix admin, event → **Go live** |
| Check-in bao lỗi 404 | Kiểm tra `listId` đung khong (mặc định la 1). Kiểm tra ticket secret đung |

---

> **Cần hỗ trợ? / Need help?** Xem log Worker: `npx wrangler tail` hoặc liên hệ team kỹ thuật.
