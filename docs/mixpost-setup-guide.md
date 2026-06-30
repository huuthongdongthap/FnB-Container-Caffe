# Huong Dan Cai Dat Mixpost Social Media cho Aura Cafe

> **Mixpost Setup Guide for Aura Cafe Social Media**
> _Huong dan tung buoc cho chu quan khong chuyen cong nghe_
> _(Step-by-step guide for non-technical cafe owners)_

**Tai lieu chinh thuc / Official docs:** https://docs.mixpost.app
**Mixpost GitHub:** https://github.com/inovector/mixpost
**API Add-on:** https://github.com/btafoya/mixpost-api

---

## 1. 📦 Mixpost — Cai Dat bang Docker

Mixpost la cong cu quan ly mang xa hoi tu dong (social media scheduler). Tu dong dang bai len Facebook, Instagram, TikTok tu du lieu Aura Cafe.

### 1.1 Yeu Cau / Prerequisites
- **Server:** Linux VPS hoac Raspberry Pi 4/5 (2GB RAM tro len)
- **Da cai Docker:** `docker --version && docker compose version`
- **Neu chua cai Docker:** `curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER` (dang xuat/dang nhap lai)
- **Neu da chay Xibo:** Mixpost chay chung VPS duoc neu co > 2GB RAM

### 1.2 Tao Docker Compose File / Create Docker Compose

```bash
mkdir ~/mixpost && cd ~/mixpost
nano docker-compose.yml
```

Dan noi dung sau vao / Paste the following:

```yaml
version: '3.8'

services:
  mixpost:
    image: inovector/mixpost-lite:latest
    container_name: mixpost-app
    ports:
      - "9000:80"
    environment:
      APP_URL: http://YOUR_SERVER_IP:9000
      APP_KEY: base64:CHANGE_ME_GENERATE_VIA_STEP_1_3
      APP_ENV: production
      APP_DEBUG: "false"
      DB_CONNECTION: mysql
      DB_HOST: mixpost-db
      DB_PORT: 3306
      DB_DATABASE: mixpost
      DB_USERNAME: mixpost
      DB_PASSWORD: CHANGE_ME_DB_PASSWORD
      REDIS_HOST: mixpost-redis
      REDIS_PASSWORD: null
    depends_on:
      - mixpost-db
      - mixpost-redis
    restart: unless-stopped
    volumes:
      - mixpost_storage:/var/www/html/storage

  mixpost-db:
    image: mysql:8.0
    container_name: mixpost-db
    environment:
      MYSQL_ROOT_PASSWORD: CHANGE_ME_ROOT_PASSWORD
      MYSQL_DATABASE: mixpost
      MYSQL_USER: mixpost
      MYSQL_PASSWORD: CHANGE_ME_DB_PASSWORD
    restart: unless-stopped
    volumes:
      - mixpost_db:/var/lib/mysql

  mixpost-redis:
    image: redis:alpine
    container_name: mixpost-redis
    restart: unless-stopped

volumes:
  mixpost_storage:
  mixpost_db:
```

### 1.3 Tao APP_KEY / Generate App Key

```bash
# Dung Docker de tao key:
docker run --rm inovector/mixpost-lite:latest php artisan key:generate --show
# Copy key tra ve (dang base64:...)
# VD: base64:AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
```

Sua lai `APP_KEY` trong `docker-compose.yml` bang key vua tao.
_Replace `APP_KEY` in docker-compose.yml with the generated key._

### 1.4 Khoi Dong / Start

```bash
docker compose up -d
# Doi 2-3 phut de MySQL khoi dong xong
# Wait 2-3 minutes for MySQL to initialize

# Kiem tra / Check status:
docker compose ps
# Ca 3 container phai "Up" / All 3 containers must show "Up"
```

### 1.5 Cai API Add-on / Install API Add-on

```bash
# Vao container cai API package / Enter container and install API
docker exec mixpost-app composer require inovector/mixpost-api
docker exec mixpost-app php artisan migrate
docker exec mixpost-app php artisan vendor:publish --tag=mixpost-api-config
```

---

## 2. 🔑 Tao API Token / Generate API Token

### 2.1 Dang Nhap Lan Dau / First Login

Mo trinh duyet: `http://YOUR_SERVER_IP:9000`

Thong tin dang nhap mac dinh / Default login:
- Email: `admin@example.com`
- Password: `password`

**IMPORTANT:** Doi mat khau ngay sau khi dang nhap!
_Change password immediately after first login!_

### 2.2 Tao Token API / Generate API Token

Vao **Settings → API Tokens** (neu co giao dien) hoac dung curl:

```bash
curl -X POST http://YOUR_SERVER_IP:9000/api/mixpost/auth/tokens \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"email":"admin@example.com","password":"YOUR_PASSWORD","token_name":"aura-bridge"}'
```

**Ket qua / Response:**
```json
{
  "token": "1|abc123def456ghi789jkl...",
  "token_type": "Bearer",
  "expires_at": null
}
```

**Luu token nay lai!** Day la "mat khau" de Aura Worker ket noi voi Mixpost.
_Save this token! Aura Worker uses it to connect to Mixpost._

---

## 3. 📱 Ket Noi Tai Khoan Mang Xa Hoi / Connect Social Accounts

### 3.1 Facebook Page

Vao **Accounts → Add Account → Facebook Page** trong Mixpost UI.

**Buoc / Steps:**
1. Dang nhap Facebook tai khoan quan ly Fanpage cua quan
2. Cap quyen cho Mixpost truy cap Pages
3. Chon Fanpage muon ket noi (VD: "Aura Cafe")
4. Xac nhan → Page hien thi trong danh sach Accounts

### 3.2 Instagram Business

**Yeu cau:** Instagram phai la Business Account va da lien ket voi Facebook Page.

Vao **Accounts → Add Account → Instagram Business**:
1. Dang nhap Facebook (cung tai khoan quan ly Page)
2. Chon Instagram Business account da lien ket
3. Xac nhan → Instagram hien thi trong danh sach Accounts

### 3.3 TikTok (Optional / Tuy Chon)

Vao **Accounts → Add Account → TikTok**:
1. Dang nhap TikTok Business account
2. Cap quyen cho Mixpost
3. Xac nhan

---

## 4. ⚙️ Cau Hinh Aura Worker / Configure Aura Worker

### 4.1 Them Env Vars vao wrangler.toml / Add to wrangler.toml

```toml
[vars]
MIXPOST_API_URL = "http://YOUR_SERVER_IP:9000"
MIXPOST_API_TOKEN = "1|abc123def456ghi789jkl..."
```

Hoac them truc tiep tren Cloudflare Dashboard / Or add via Cloudflare Dashboard:
- **Workers & Pages → aura-worker → Settings → Variables**
- Them 2 bien / Add 2 variables:
  - `MIXPOST_API_URL` = `http://YOUR_SERVER_IP:9000`
  - `MIXPOST_API_TOKEN` = `1|abc123def456ghi789jkl...`

### 4.2 Kiem Tra Ket Noi / Test Connection

```bash
curl -X GET https://fnb-caffe-container.pages.dev/api/mixpost/accounts
```

**Ket qua mong doi / Expected:**
```json
{
  "success": true,
  "accounts": [
    {"id": 1, "name": "Aura Cafe Facebook", "platform": "facebook"},
    {"id": 2, "name": "auracafe.insta", "platform": "instagram"}
  ]
}
```

Neu khong thay accounts: kiem tra lai `MIXPOST_API_URL` va `MIXPOST_API_TOKEN`.
_If no accounts: double-check MIXPOST_API_URL and MIXPOST_API_TOKEN._

---

## 5. 🗓️ Lich Tu Dong / Auto-Scheduling

Sau khi cau hinh xong, Aura Worker tu dong:

| Thoi Gian | Hanh Dong |
|-----------|-----------|
| **07:00 hang ngay** | Dang bai "Mon dac biet hom nay" tu menu Aura |
| **08:00 hang ngay** | Dang bai khuyen mai moi (neu co) |
| **09:00 thu 2** | Dang bai "Best seller tuan nay" |

**Khong can lam gi them!** Bai viet tu dong xuat hien trong Mixpost queue.
_Nothing else needed! Posts auto-appear in Mixpost queue._

---

## 6. 🔧 Khac Phuc Loi / Troubleshooting

| Loi / Problem | Nguyen Nhan / Cause | Cach Sua / Fix |
|---------------|---------------------|----------------|
| **Mixpost khong khoi dong** | Port 9000 bi chiem hoac MySQL chua san sang | `docker compose logs mixpost` de xem loi. Doi them 2-3 phut. |
| **API tra ve 401** | Token het han hoac sai | Tao lai token (Section 2.2). Cap nhat `MIXPOST_API_TOKEN`. |
| **Khong thay accounts** | Chua ket noi Facebook/Instagram trong Mixpost | Vao Mixpost UI → Accounts → Add Account |
| **Bai viet khong dang** | Facebook token trong Mixpost het han | Vao Mixpost → Accounts → Reconnect Facebook |
| **Worker khong ket noi duoc Mixpost** | Mixpost chay tren mang noi bo, Worker la Cloudflare (internet) | Dam bao `MIXPOST_API_URL` la IP cong khai hoac domain. Dung ngrok neu can. |
| **Trang trang / White screen** | APP_KEY chua duoc tao hoac sai | Chay lai Section 1.3 de tao APP_KEY moi |

---

*Cap nhat / Last updated: 2026-07-01 — Mixpost v2.6.0*
