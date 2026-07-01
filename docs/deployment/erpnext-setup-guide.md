# Huong Dan Trien Khai ERPNext v15 cho Quan Ca Phe Nho / ERPNext v15 Deployment Guide for Small Cafe

**Phien ban:** 1.0 | **Ngay:** 2026-06-30

---

## 1. Tong Quan / Overview

Tai lieu nay huong dan trien khai **ERPNext v15** (phan mem quan ly doanh nghiep ma nguon mo) tren VPS gia re cho quan ca phe nho tai Vietnam. ERPNext giup ban quan ly: ban hang, ton kho, hoa don, nhan su, luong, va bao cao tai chinh.

This guide covers deploying **ERPNext v15** (open-source ERP) on a budget VPS for a small Vietnamese cafe. ERPNext helps manage: sales, inventory, invoices, staff, payroll, and financial reports.

### 1.1 Kien Truc He Thong / System Architecture

```
[Internet]
    |
    | HTTPS (port 443)
    |
[Nginx Reverse Proxy] --- Let's Encrypt SSL (Certbot)
    |
    | HTTP :8080
    |
[Docker Container: frappe/erpnext:v15]
    |--- backend    (Gunicorn WSGI)
    |--- frontend   (Nginx trong container)
    |--- websocket  (Socket.IO real-time)
    |--- queue-short/long (background jobs)
    |--- scheduler  (cron jobs)
    |
[Docker Container: mariadb:10.6]   --->   /var/lib/docker/volumes/ (database)
[Docker Container: redis:6.2]      --->   cache + queue
```

### 1.2 Luong Du Lieu voi CF Worker / Data Flow with CF Worker

```
[CF Worker] --- REST API (Authorization: token {api_key}:{api_secret}) ---> [ERPNext]
       |                                                                         |
       | GET/POST tai lieu don hang, san pham, khach hang                        |
       |_________________________________________________________________________|

Bien moi truong can co trong Worker:
  ERPNEXT_URL=https://erpnext.quancafe.example.com
  ERPNEXT_API_KEY=abc123...
  ERPNEXT_API_SECRET=xyz789...
```

---

## 2. So Sanh 3 Phuong Phap Trien Khai / Compare 3 Deployment Methods

### 2.1 Bang So Sanh / Comparison Table

| Tieu chi | Docker Self-Hosted (Khuyen nghi) | Frappe Cloud | Cai dat thu cong (Manual) |
|---|---|---|---|
| **Chi phi/thang** | ~300.000 VND ($12) | ~500.000 VND ($20) | ~300.000 VND ($12) |
| **Do kho** | Trung binh | De | Cao |
| **Kien thuc yeu cau** | Docker co ban | Khong can IT | Linux, Python, MariaDB |
| **Bao tri** | Tu bao tri | Frappe lo | Tu bao tri |
| **SSL** | Certbot tu dong | Co san | Tu cau hinh |
| **Backup** | Tu viet cron | Co san | Tu viet script |
| **Kha nang mo rong** | Cao | Trung binh | Cao |
| **Kiem soat** | Toan bo | Gioi han (shared hosting) | Toan bo |

### 2.2 Khuyen Nghi / Recommendation

**=> DUNG Docker Self-Hosted** tren VPS 4GB RAM (khoang 300K VND/thang).

Ly do:
- Chi phi thap nhat cho production
- Kiem soat hoan toan du lieu (quan ca phe khong muon data o may chu nuoc ngoai)
- De nang cap / mo rong sau nay
- Cong dong lon, tai lieu nhieu

> **Khi nao dung Frappe Cloud?** Neu ban KHONG co nguoi IT hoac khong muon tu quan tri server. Tra them ~200K/thang de Frappe lo het bao tri.

---

## 3. Dieu Kien Tien Quyet / Prerequisites

### 3.1 VPS Server

Mua VPS tu mot trong cac nha cung cap:

| Nha cung cap | Gia khoang | Ghi chu |
|---|---|---|
| **Hetzner** (Duc) | ~4 EUR/th (~120K VND) | Re nhat, chat luong tot |
| **DigitalOcean** (My) | $12/th (~300K VND) | De dung, tai lieu nhieu |
| **Vietnix** (Vietnam) | ~200K-350K VND/th | Ho tro tieng Viet, thanh toan chuyen khoan |
| **Nhan Hoa** (Vietnam) | ~250K VND/th | Pho bien tai Vietnam |

**Cau hinh toi thieu:**
- RAM: **4 GB** (toi thieu, khuyen nghi 8GB)
- CPU: **2 cores**
- O cung: **40 GB SSD**
- He dieu hanh: **Ubuntu 22.04 LTS**
- Bang thong: 1 Gbps

### 3.2 Ten Mien / Domain

Mua ten mien (VD: `quancafe.example.com`) tu mot trong cac nha dang ky:
- **PA Vietnam** (pavietnam.vn) ~200K VND/nam
- **iNET** (inet.vn)
- **Namecheap** (quoc te) ~$10/nam

### 3.3 DNS

Tao ban ghi A tro ten mien toi IP VPS:

```
erpnext.quancafe.example.com  A  <IP_VPS_CUA_BAN>
```

### 3.4 Kiem Tra Truoc Khi Bat Dau / Pre-flight Check

```bash
# Kiem tra Ubuntu version
lsb_release -a

# Output mong doi:
# Distributor ID: Ubuntu
# Description:    Ubuntu 22.04.5 LTS
# Release:        22.04

# Kiem tra RAM
free -h
# Output: total >= 3.5G

# Kiem tra dung luong o cung
df -h /
# Output: available >= 30G
```

---

## 4. Cai Dat Docker / Install Docker

### 4.1 Cai Docker Engine + Docker Compose

Copy-paste tung lenh mot:

```bash
# Buoc 1: Update he thong
sudo apt update && sudo apt upgrade -y

# Buoc 2: Cai dat dependencies
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Buoc 3: Them Docker repo
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Buoc 4: Cai Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Buoc 5: Kiem tra
sudo docker run hello-world
# Output: "Hello from Docker!" + thong tin

# Buoc 6: Kich hoat Docker tu dong khoi dong cung he thong
sudo systemctl enable docker
sudo systemctl start docker

# Buoc 7: Them user hien tai vao docker group (de khong can sudo)
sudo usermod -aG docker $USER
echo "=== DANG XUAT VA DANG NHAP LAI DE AP DUNG ==="
echo "Chay: exit, ssh lai vao VPS"
```

> **Luu y:** Sau buoc 7, ban can thoat (`exit`) va SSH lai vao VPS de thay doi co hieu luc.

### 4.2 Kiem Tra Docker / Verify Docker

```bash
# Sau khi dang nhap lai
docker --version
# Output: Docker version 26.x.x

docker compose version
# Output: Docker Compose version v2.x.x

docker ps
# Output: (danh sach container, dang trong)
```

---

## 5. Trien Khai ERPNext / Deploy ERPNext

### 5.1 Lay Ma Nguon frappe_docker

```bash
# Tao thu muc lam viec
sudo mkdir -p /opt/erpnext
sudo chown $USER:$USER /opt/erpnext
cd /opt/erpnext

# Clone repo chinh thuc
git clone https://github.com/frappe/frappe_docker.git
cd frappe_docker
```

### 5.2 Tao File Cau Hinh Mo Truong / Create .env File

Tao file `.env` voi thong tin cua ban:

```bash
# Tao file .env tu mau
cp example.env .env

# Sua noi dung file
nano .env
```

Sua cac dong sau (thay `...` bang gia tri cua ban):

```env
# Ten project (dat de nho)
COMPOSE_PROJECT_NAME=erpnext

# Version ERPNext (dung phien ban on dinh)
ERPNEXT_VERSION=v15.88.1

# Mat khau database (DAT MAT KHAU MANH!!!)
DB_PASSWORD=MatKhauDatabaseManh_2026!

# Domain cua ban
SITES=erpnext.quancafe.example.com

# Domain cho HTTPS
SITES_RULE=Host(`erpnext.quancafe.example.com`)
NGINX_PROXY_HOSTS=erpnext.quancafe.example.com
```

> **Chan trong:** Mat khau DB_PASSWORD phai la mat khau manh, it nhat 12 ky tu, co chu hoa, chu thuong, so va ky tu dac biet.

### 5.3 Khoi Dong ERPNext / Start ERPNext

```bash
# Tao thu muc gitops de luu cau hinh
mkdir -p ~/gitops

# Sinh file docker-compose hoan chinh
docker compose --env-file .env \
  -f compose.yaml \
  -f overrides/compose.mariadb.yaml \
  -f overrides/compose.redis.yaml \
  -f overrides/compose.https.yaml \
  config > ~/gitops/erpnext-production.yaml

# Khoi dong tat ca container
docker compose -f ~/gitops/erpnext-production.yaml up -d
```

**Output mong doi:**
```
[+] Running 8/8
 * Container erpnext-mariadb-1       Started
 * Container erpnext-redis-cache-1   Started
 * Container erpnext-redis-queue-1   Started
 * Container erpnext-configurator-1  Started
 * Container erpnext-backend-1       Started
 * Container erpnext-frontend-1      Started
 * Container erpnext-scheduler-1     Started
 * Container erpnext-websocket-1     Started
```

### 5.4 Kiem Tra Trang Thai / Check Status

```bash
# Xem log cua container
docker compose -f ~/gitops/erpnext-production.yaml logs -f

# Nhan Ctrl+C de thoat khoi log

# Kiem tra container dang chay
docker compose -f ~/gitops/erpnext-production.yaml ps

# Output mong doi: tat ca 8 container "Up"
```

### 5.5 Tao Site ERPNext / Create ERPNext Site

```bash
# Tao site moi (thay domain bang domain that cua ban)
docker compose -f ~/gitops/erpnext-production.yaml exec backend \
  bench new-site erpnext.quancafe.example.com \
  --mariadb-user-host-login-scope=% \
  --db-root-password MatKhauDatabaseManh_2026! \
  --admin-password AdminMatKhau_2026!
```

**Output mong doi (3-5 phut):**
```
Creating site erpnext.quancafe.example.com...
Site erpnext.quancafe.example.com created
Installing frappe...
*** Scheduler is enabled for erpnext.quancafe.example.com
```

### 5.6 Cai App ERPNext / Install ERPNext App

```bash
# Cai app ERPNext vao site
docker compose -f ~/gitops/erpnext-production.yaml exec backend \
  bench --site erpnext.quancafe.example.com install-app erpnext

# Kich hoat scheduler
docker compose -f ~/gitops/erpnext-production.yaml exec backend \
  bench --site erpnext.quancafe.example.com enable-scheduler
```

**Output mong doi (5-10 phut):**
```
Installing erpnext...
Updating DocTypes...
Installing fixtures...
...
Done
```

### 5.7 Cau Hinh WebSocket / Configure WebSocket

```bash
docker compose -f ~/gitops/erpnext-production.yaml exec backend bash -lc "
  bench --site erpnext.quancafe.example.com set-config websocket_url 'wss://erpnext.quancafe.example.com'
  bench --site erpnext.quancafe.example.com set-config socketio_origin 'https://erpnext.quancafe.example.com'
  bench --site erpnext.quancafe.example.com set-config host_name 'https://erpnext.quancafe.example.com'
"

# Restart cac dich vu
docker compose -f ~/gitops/erpnext-production.yaml restart websocket backend frontend
```

---

## 6. Cau Hinh SSL / Setup SSL (Let's Encrypt)

### 6.1 Cai Nginx + Certbot (Tren VPS, ngoai container)

```bash
# Cai dat Nginx
sudo apt install -y nginx

# Cai dat Certbot
sudo apt install -y certbot python3-certbot-nginx

# Tao cau hinh Nginx tam cho domain (de Certbot co the xac minh)
sudo tee /etc/nginx/sites-available/erpnext << 'EOF'
server {
    listen 80;
    server_name erpnext.quancafe.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Kich hoat site
sudo ln -s /etc/nginx/sites-available/erpnext /etc/nginx/sites-enabled/
sudo nginx -t  # Kiem tra cau hinh
# Output: syntax is ok / test is successful

sudo systemctl reload nginx
```

### 6.2 Xin SSL Certificate / Get SSL Certificate

```bash
# Xin chung chi SSL tu dong
sudo certbot --nginx -d erpnext.quancafe.example.com --non-interactive --agree-tos -m email@cua-ban.com

# Output mong doi:
# Successfully received certificate.
# Certificate is saved at: /etc/letsencrypt/live/erpnext.quancafe.example.com/fullchain.pem
```

### 6.3 Kiem Tra Tu Dong Gia Han SSL / Auto-renew Check

```bash
# Kiem tra Certbot tu dong gia han
sudo certbot renew --dry-run

# Output mong doi:
# Congratulations, all renewals succeeded.

# Kiem tra cron job gia han
sudo systemctl list-timers | grep certbot
# Output: certbot.timer (next trigger: tomorrow)
```

### 6.4 Cau Hinh Nginx Hoan Chinh / Final Nginx Config

Sau khi Certbot cap SSL, no tu dong cap nhat file cau hinh Nginx. Kiem tra:

```bash
sudo cat /etc/nginx/sites-available/erpnext
```

No se co dang:

```nginx
server {
    listen 443 ssl;
    server_name erpnext.quancafe.example.com;

    ssl_certificate /etc/letsencrypt/live/erpnext.quancafe.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/erpnext.quancafe.example.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Quan trong: WebSocket support
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }

    # WebSocket cho real-time
    location /socket.io/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name erpnext.quancafe.example.com;
    return 301 https://$server_name$request_uri;
}
```

> **Quan trong:** Dong `proxy_pass http://127.0.0.1:8080` rat quan trong. ERPNext container frontend dang lang nghe o port 8080 trong container, duoc map ra port 8080 tren VPS (xem trong compose.yaml). Kiem tra port:

```bash
# Kiem tra port frontend ERPNext
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep frontend
# Output: erpnext-frontend-1  0.0.0.0:8080->8080/tcp
```

---

## 7. Cau Hinh Firewall / Configure UFW Firewall

**Luu y quan trong:** Docker mac dinh BO QUA UFW. Can cau hinh dac biet de UFW co tac dung voi Docker.

### 7.1 Mo Port Can Thiet / Open Required Ports

```bash
# Cai UFW (neu chua co)
sudo apt install -y ufw

# Cho phep SSH (LAM TRUOC TIEN de khong bi khoa tai khoan!)
sudo ufw allow 22/tcp

# Cho phep HTTP va HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Cau hinh Mac dinh: chan het, mo tu chon
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Kich hoat UFW
sudo ufw --force enable

# Kiem tra
sudo ufw status verbose
# Output:
# Status: active
# To                         Action      From
# --                         ------      ----
# 22/tcp                     ALLOW       Anywhere
# 80/tcp                     ALLOW       Anywhere
# 443/tcp                    ALLOW       Anywhere
# 22/tcp (v6)                ALLOW       Anywhere (v6)
# 80/tcp (v6)                ALLOW       Anywhere (v6)
# 443/tcp (v6)               ALLOW       Anywhere (v6)
```

### 7.2 Cau Hinh UFW + Docker / Fix UFW Docker Bypass

Tao file `/etc/ufw/after.rules` neu chua co, va them vao CUOI file:

```bash
sudo tee -a /etc/ufw/after.rules << 'EOF'

# BEGIN UFW AND DOCKER
*filter
:ufw-user-forward - [0:0]
:DOCKER-USER - [0:0]
-A DOCKER-USER -j ufw-user-forward
-A DOCKER-USER -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
-A DOCKER-USER -m limit --limit 3/min --limit-burst 10 -j LOG --log-prefix "[UFW DOCKER BLOCK] "
-A DOCKER-USER -j DROP
COMMIT
# END UFW AND DOCKER
EOF

# Apply lai
sudo ufw reload
sudo systemctl restart docker
```

### 7.3 Mo Port Cho Container ERPNext / Allow Container Ports

```bash
# Cho phep luong vao container ERPNEXT tu ben ngoai
sudo ufw route allow proto tcp from any to any port 80
sudo ufw route allow proto tcp from any to any port 443
sudo ufw route allow proto tcp from any to any port 8080

sudo ufw reload
```

---

## 8. Cai Dat Sao Luu Tu Dong / Setup Automated Backups

### 8.1 Tao Script Backup / Create Backup Script

```bash
# Tao thu muc chua backup
sudo mkdir -p /backups/erpnext
sudo chmod 755 /backups/erpnext

# Tao script backup
sudo tee /opt/erpnext/backup-erpnext.sh << 'SCRIPT'
#!/bin/bash
# ============================================
# ERPNext Backup Script
# Backup to /backups/erpnext/
# ============================================

BACKUP_DIR="/backups/erpnext"
DATE=$(date +%Y%m%d_%H%M%S)
PROJECT_DIR="/opt/erpnext/frappe_docker"
COMPOSE_FILE="$HOME/gitops/erpnext-production.yaml"
SITE_NAME="erpnext.quancafe.example.com"
RETENTION_DAYS=30

echo "[$(date)] === Bat dau backup ERPNext ==="

# Tao thu muc backup
mkdir -p $BACKUP_DIR/$DATE

# 1. Backup database + files dung bench
echo "[$(date)] Backup site: $SITE_NAME"
docker compose -f $COMPOSE_FILE exec -T backend \
  bench --site $SITE_NAME backup --with-files \
  --backup-path /tmp/erpnext-backup/

# 2. Copy backup tu container ra VPS
echo "[$(date)] Copy backup ra VPS"
BACKUP_CONTAINER=$(docker compose -f $COMPOSE_FILE ps -q backend)
docker cp $BACKUP_CONTAINER:/tmp/erpnext-backup/ $BACKUP_DIR/$DATE/

# 3. Xoa backup tam trong container
docker compose -f $COMPOSE_FILE exec -T backend rm -rf /tmp/erpnext-backup/

# 4. Nen backup de tiet kiem dung luong
echo "[$(date)] Nen backup"
tar -czf $BACKUP_DIR/erpnext-$DATE.tar.gz -C $BACKUP_DIR/$DATE .
rm -rf $BACKUP_DIR/$DATE

# 5. Xoa backup cu hon 30 ngay
echo "[$(date)] Xoa backup cu hon $RETENTION_DAYS ngay"
find $BACKUP_DIR -name "erpnext-*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] === Hoan thanh backup ==="
echo "Backup file: $BACKUP_DIR/erpnext-$DATE.tar.gz"
echo "Dung luong: $(du -h $BACKUP_DIR/erpnext-$DATE.tar.gz | cut -f1)"
SCRIPT

# Phan quyen thuc thi
sudo chmod +x /opt/erpnext/backup-erpnext.sh
```

### 8.2 Tao Cron Job / Setup Cron Job

```bash
# Mo crontab cho root (de co quyen truy cap docker)
sudo crontab -e
```

Them dong sau vao CUOI file:

```cron
# Backup ERPNext moi ngay luc 2:00 sang
0 2 * * * /bin/bash /opt/erpnext/backup-erpnext.sh >> /var/log/erpnext-backup.log 2>&1
```

Kiem tra:

```bash
sudo crontab -l
# Output:
# Backup ERPNext moi ngay luc 2:00 sang
# 0 2 * * * /bin/bash /opt/erpnext/backup-erpnext.sh >> /var/log/erpnext-backup.log 2>&1
```

### 8.3 Kiem Tra Backup Thu Cong / Test Backup Manually

```bash
# Chay backup thu cong de kiem tra
sudo bash /opt/erpnext/backup-erpnext.sh

# Kiem tra file backup da tao
ls -la /backups/erpnext/
# Output: erpnext-20260630_020000.tar.gz

# Kiem tra log
tail -20 /var/log/erpnext-backup.log
```

---

## 9. Tao API Key cho CF Worker / Generate API Key for CF Worker

### 9.1 Dang Nhap ERPNext / Login

1. Mo trinh duyet, vao `https://erpnext.quancafe.example.com`
2. Dang nhap voi:
   - **Username:** `Administrator`
   - **Password:** `AdminMatKhau_2026!` (mat khau ban dat o buoc 5.5)

### 9.2 Tao API Key

1. Nhan vao **avatar** (goc tren phai) -> **My Settings**
2. Keo xuong muc **API Access**
3. Nhan **Generate Keys**
4. **SAO CHEP NGAY** API Secret (no chi xuat hien 1 lan!)
5. Ghi lai:
   - **API Key:** (vi du: `a1b2c3d4e5f6g7`)
   - **API Secret:** (vi du: `h8i9j0k1l2m3n4`)

> **Canh bao:** API Secret chi hien thi mot lan. Neu bi mat, ban phai generate lai.

### 9.3 Kiem Tra API / Verify API

```bash
# Kiem tra API tu VPS
curl -X GET "https://erpnext.quancafe.example.com/api/method/frappe.auth.get_logged_user" \
  -H "Authorization: token API_KEY_CUA_BAN:API_SECRET_CUA_BAN"

# Output mong doi:
# {"message":"Administrator"}
```

Neu nhan duoc message `"Administrator"` -> API hoat dong tot!

### 9.4 Them Vao CF Worker Env

Trong Cloudflare Worker, them cac bien moi truong:

```env
ERPNEXT_URL = "https://erpnext.quancafe.example.com"
ERPNEXT_API_KEY = "a1b2c3d4e5f6g7"
ERPNEXT_API_SECRET = "h8i9j0k1l2m3n4"
```

---

## 10. Cai Dat Tieng Viet / Setup Vietnamese Language

### 10.1 Qua Giao Dien Web / Via Web UI

1. Dang nhap ERPNext voi `Administrator`
2. Vao **Setting > System Settings**
3. Trong **Language** -> chon **Vietnamese (vi)**
4. Luu lai
5. Refresh trang (F5)

### 10.2 Qua CLI (Neu UI khong hoat dong) / Via CLI (If UI doesn't work)

```bash
# Dat tieng Viet cho site
docker compose -f ~/gitops/erpnext-production.yaml exec backend \
  bench --site erpnext.quancafe.example.com set-config language vi

# Clear cache
docker compose -f ~/gitops/erpnext-production.yaml exec backend \
  bench clear-cache
```

### 10.3 Luu Y / Known Issues

- **Tieng Viet co the hien tieng Anh** neu ban dang xuat - dang nhap lai la xong
- **Mot so nut/chuc nang** co the chua duoc dich day du (ERPNext dich ~80% tieng Viet)
- Neu thieu tu, ban co the tu them tai: **Setting > Translations > New Translation**

---

## 11. Thiet Lap Dau Cho Quan Ca Phe / Initial Setup for Cafe

### 11.1 Cac Buoc Co Ban / Basic Setup Steps

Sau khi cai dat xong, thiet lap co ban:

1. **Company (Cong ty):** Dat ten cong ty (VD: "Quan Ca Phe ABC")
   - Trang chu (Home) -> Master Data -> Company -> New
2. **Chart of Accounts (So Do Tai Khoan):** ERPNext tu dong tao cho Vietnam
3. **Item (San pham):** Them cac mon: Ca phe den, Ca phe sua, Tra, Banh mi...
4. **Customer (Khach hang):** Them khach hang le
5. **POS Profile (Cai dat POS):** Tao POS de ban hang

### 11.2 Cac Module Chinh / Key Modules

| Module | Chuc nang | Tieng Viet / English |
|---|---|---|
| **Selling** | Ban hang, POS | Ban hang |
| **Stock** | Kho, nhap xuat ton | Kho |
| **Accounting** | Cong no, thu chi | Ke toan |
| **HR** | Nhan vien, cham cong | Nhan su |
| **Buying** | Mua nguyen lieu | Mua hang |

---

## 12. Bang Chi Phi Uoc Tinh / Cost Estimate Table

### Chi phi thang / Monthly Costs

| Khoan muc | VND | USD | Ghi chu |
|---|---|---|---|
| VPS 4GB | 200,000 - 400,000 | $8 - $16 | Hetzner/Vietnix |
| Ten mien (phan bo theo thang) | 15,000 - 20,000 | $0.60 - $0.80 | ~200K VND/nam |
| Backup storage | 0 | $0 | Cung VPS, du 40GB |
| **Tong cong/thang** | **~215,000 - 420,000** | **~$8.60 - $16.80** | |

### Chi phi 1 lan / One-time Costs

| Khoan muc | VND | USD |
|---|---|---|
| Ten mien (nam dau) | ~200,000 | ~$8 |
| SSL certificate | 0 (Let's Encrypt) | $0 |
| **Tong cong 1 lan** | **~200,000** | **~$8** |

### So sanh voi cac dich vu ERP khac / Comparison

| Giai phap | Chi phi/thang | Ghi chu |
|---|---|---|
| **ERPNext tu host (cach nay)** | **~300,000 VND** | **Tiet kiem nhat** |
| Frappe Cloud (Site $5) | ~500,000 VND | Khoi lo IT |
| MISA | ~500,000 - 1,000,000 VND | Theo nguoi dung |
| Odoo Online | ~1,000,000+ VND | Theo nguoi dung |
| Phan mem ban hang offline | ~200,000 - 500,000 | Nhieu gioi han |

---

## 13. Khac Phuc Su Co Thuong Gap / Troubleshooting

### 13.1 Container khong chay / Containers not starting

```
# Kiem tra log
docker compose -f ~/gitops/erpnext-production.yaml logs

# Van de thuong gap: Cong 80/443 da co app khac dung
# Giai phap: Tat Nginx tren host
sudo systemctl stop nginx
sudo systemctl disable nginx

# Khoi dong lai ERPNext
docker compose -f ~/gitops/erpnext-production.yaml down
docker compose -f ~/gitops/erpnext-production.yaml up -d
```

### 13.2 Site tao that bai / Site creation fails

```
# Loi thuong gap: Mat khau DB sai
# Giai phap: Kiem tra .env, dam bao DB_PASSWORD trung khop

# Loi: MariaDB chua san sang
# Giai phap: Doi MariaDB khoi dong xong
docker compose -f ~/gitops/erpnext-production.yaml logs mariadb
# Cho den khi thay: "ready for connections"
```

### 13.3 SSL khong hoat dong / SSL not working

```
# Kiem tra cong 80 dang mo
curl -I http://erpnext.quancafe.example.com
# Phai tra ve 301 (chuyen huong sang HTTPS)

# Kiem tra DNS
dig +short erpnext.quancafe.example.com
# Phai tra ve IP VPS cua ban

# Kiem tra Nginx
sudo nginx -t
sudo systemctl status nginx
```

### 13.4 API tra ve 401 / API returns 401

```
# Nguyen nhan: API Key hoac Secret sai
# Giai phap: Tao lai API key trong ERPNext

# Kiem tra URL dung chua
echo $ERPNEXT_URL
# Phai co https:// va KHONG co / o cuoi
```

### 13.5 VPS het RAM / VPS out of memory

```
# Kiem tra RAM su dung
free -h

# Giai phap 1: Them swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Giai phap 2: Giam worker trong compose
# Sua compose override de giam workers
```

### 13.6 Dung luong o cung day / Disk full

```bash
# Kiem tra dung luong
df -h

# Xoa backup cu
find /backups/erpnext -name "*.tar.gz" -mtime +30 -delete

# Xoa Docker unused data
docker system prune -f

# Kiem tra thu muc nao nhieu nhat
du -sh /* 2>/dev/null | sort -rh | head -10
```

---

## 14. Nang Cap ERPNext / Upgrading ERPNext

Khi co phien ban moi:

```bash
cd /opt/erpnext/frappe_docker

# Cap nhat ma nguon
git pull

# Lay image moi
docker compose -f ~/gitops/erpnext-production.yaml pull

# Khoi dong lai
docker compose -f ~/gitops/erpnext-production.yaml up -d

# Chay migration
docker compose -f ~/gitops/erpnext-production.yaml exec backend \
  bench --site erpnext.quancafe.example.com migrate
```

> **Luon backup truoc khi nang cap!**

---

## 15. References / Tai lieu tham khao

| Tai lieu | Link |
|---|---|
| Frappe Docker chinh thuc | https://github.com/frappe/frappe_docker |
| Huong dan Production Docker | https://deepwiki.com/frappe/frappe_docker/3.2-production-deployment |
| Frappe Cloud Pricing | https://frappe.io/cloud/pricing |
| Huong dan cai dat ERPNext | https://docs.erpnext.com |
| Let's Encrypt + Certbot | https://certbot.eff.org |
| UFW + Docker fix | https://github.com/chaifeng/ufw-docker |
| ERPNext API docs | https://frappe.io/docs |

---

## 16. Checklist Tong The / Master Checklist

```
Truoc khi bat dau:
[ ] Mua VPS (4GB RAM, Ubuntu 22.04)
[ ] Mua ten mien
[ ] Tro DNS A record ve IP VPS

Cai dat:
[ ] Docker + Docker Compose (Phan 4)
[ ] Clone frappe_docker (Phan 5.1)
[ ] Tao .env (Phan 5.2)
[ ] Khoi dong container (Phan 5.3)
[ ] Tao site (Phan 5.5)
[ ] Cai ERPNext app (Phan 5.6)

SSL + Firewall:
[ ] Cai Nginx + Certbot (Phan 6.1)
[ ] Xin SSL (Phan 6.2)
[ ] Cau hinh UFW (Phan 7)

Sao luu:
[ ] Tao backup script (Phan 8.1)
[ ] Them cron job (Phan 8.2)
[ ] Kiem tra backup thu cong (Phan 8.3)

API cho Worker:
[ ] Tao API Key (Phan 9.2)
[ ] Kiem tra API (Phan 9.3)
[ ] Them vao CF Worker env (Phan 9.4)

Thiet lap:
[ ] Dat tieng Viet (Phan 10)
[ ] Tao Company, Items, POS (Phan 11)
[ ] Kiem tra backup chay ngay mai (Phan 8.3)
```

---

*--- Tai lieu nay duoc tao cho FnB-Container-Caffe. Cap nhat lan cuoi: 2026-06-30 ---*
