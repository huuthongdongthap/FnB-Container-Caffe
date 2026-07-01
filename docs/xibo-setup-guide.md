# Huong Dan Cai Dat Xibo Digital Signage cho Aura Cafe

> **Xibo Setup Guide for Aura Cafe Digital Signage**
> _Huong dan tuong buoc cho chu quan khong chuyen cong nghe_
> _(Step-by-step guide for non-technical cafe owners)_

**Tai lieu chinh thuc / Official docs:** https://xibosignage.com/docs
**Xibo Docker:** https://github.com/xibosignage/xibo-docker
**Xibo Player Linux:** https://github.com/xibosignage/xibo-player-linux

---

## 1. 📦 Xibo CMS — Cai Dat bang Docker

Xibo CMS la may chu quan ly noi dung (content management server). Noi dung gui tu day ra man hinh TV.

### 1.1 Yeu Cau / Prerequisites
- **Server:** Linux VPS hoac Raspberry Pi 4/5 (4GB RAM tro len)
- **Da cai Docker:** `docker --version && docker compose version`
- **Neu chua cai Docker:** `curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER` (dang xuat/dang nhap lai)

### 1.2 Tai va Giai nen / Download and Extract

```bash
wget https://github.com/xibosignage/xibo-docker/archive/refs/tags/4.4.3.tar.gz
tar -xzf 4.4.3.tar.gz
cd xibo-docker-4.4.3
```

### 1.3 Cau Hinh / Configure

```bash
cp config.env.template config.env
nano config.env
```

**Sua cac gia tri sau / Change these values:**

| Bien / Variable | Gia tri / Value | Ghi chu / Note |
|---|---|---|
| `MYSQL_ROOT_PASSWORD` | `changeme123` | **Doi ngay sau cai xong!** / Change immediately! |
| `CMS_TIMEZONE` | `Asia/Ho_Chi_Minh` | Dat gio Viet Nam / Set Vietnam time |
| `CMS_PORT` | `8080` | Doi thanh 80 neu co domain / Change to 80 if using domain |

### 1.4 Khoi Dong / Start

```bash
docker compose up -d
# Kiem tra: 5 container xibo-cms-* phai "Up" / Check: 5 containers must show "Up"
docker ps
```

**5 container:** `cms-web` (giao dien CMS), `cms-xmr` (ket noi player), `cms-db` (MySQL), `memcached` (bo nho dem), `quickchart` (bieu do)

### 1.5 Dang Nhap Lan Dau / First Login

- **URL:** `http://[IP-server]:8080`
- **Tai khoan:** `admin` / `admin`
- **Bat buoc doi mat khau ngay** (vi du: `AuraCafe@2026!`)
  - Force password change on first login

### 1.6 Tao Display User cho Player

> Player can tai khoan rieng de xac thuc voi CMS.
> The player needs a separate account to authenticate with CMS.

1. **Administration > Users > Add User**
2. Nhap / Enter:
   - **User Name:** `display-player`
   - **Password:** `DisplayPlayer123!`
   - **User Type:** `Display`
3. Luu / Save
4. Vao **Displays** > copy **Display Key** cua user nay (_can cho buoc 2.3_)

---

## 2. 🖥️ Xibo Player — Cai Dat tren Raspberry Pi

Xibo Player nhan noi dung tu CMS va hien thi len TV qua HDMI.

### 2.1 Chuan Bi SD Card

- Tai / Download: **Raspberry Pi OS Lite (64-bit)** — https://www.raspberrypi.com/software/operating-systems/
- Dung **Raspberry Pi Imager** de flash vao SD card
- **Settings (icon rang cua):** Enable SSH, hostname `xibo-player`, cau hinh WiFi cafe

### 2.2 Cai Xibo Player

```bash
# SSH vao Raspberry Pi
ssh pi@xibo-player.local
# Password mac dinh: raspberry

# Cap nhat va cai Xibo Player
sudo apt update && sudo apt upgrade -y
wget https://github.com/xibosignage/xibo-player-linux/releases/download/1.0.0/xibo-player-linux-arm64.tar.gz
mkdir -p ~/xibo-player
tar -xzf xibo-player-linux-arm64.tar.gz -C ~/xibo-player
chmod +x ~/xibo-player/xibo-player
```

### 2.3 Cau Hinh Player

```bash
nano ~/xibo-player/config.json
```

Noi dung / Content:
```json
{
  "cmsUrl": "http://[IP-server]:8080",
  "displayKey": "[Display Key tu buoc 1.6]",
  "displayName": "Aura Cafe Menu Screen",
  "settings": { "screenDimensions": "1920x1080", "orientation": "landscape" }
}
```

Thay `[IP-server]` bang IP that cua may chu CMS. Thay `[Display Key]` bang key da copy o buoc 1.6.

### 2.4 Tu Dong Khoi Dong / Auto-Start (systemd)

```bash
sudo nano /etc/systemd/system/xibo-player.service
```

Noi dung / Content:
```ini
[Unit]
Description=Xibo Player - Aura Cafe
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/xibo-player
ExecStart=/home/pi/xibo-player/xibo-player --config /home/pi/xibo-player/config.json
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Kich hoat / Enable and start:
```bash
sudo systemctl enable xibo-player.service
sudo systemctl start xibo-player.service
sudo systemctl status xibo-player.service
# Phai thay "active (running)" va "enabled"
```

### 2.5 Option B: Android TV / Smart TV

- **Android TV:** Google Play Store > tim "Xibo Player" > cai dat
- **Samsung/LG:** Xem tai https://xibosignage.com/players
- Cau hinh: Mo app > nhap CMS URL + Display Key (nhu buoc 2.3)

---

## 3. 📺 Import Widget HTML vao Xibo CMS

Widget HTML la file tu `signage-widgets/` (menu-board, promo-screen, welcome-screen) chua noi dung hien thi tren TV.

### 3.1 Tao Layout Moi / Create Layout

1. **Design > Layouts > Add Layout**
2. **Name:** `Aura Menu Board`, **Width:** `1920`, **Height:** `1080`, **Orientation:** `Landscape`
3. Nhan **Save**

### 3.2 Them Widget HTML

1. **Add Region** — keo vung phu kin man hinh (0,0 den 1920,1080)
2. Nhan vao region > **Widgets > Embedded HTML**
3. **Name:** `Menu Board Widget`, **Duration:** `0` (0 = vo han / infinite)
4. Tab **HTML:** dan code tu `signage-widgets/menu-board.html`
5. Nhan **Save**

### 3.3 Lap Lai cho Cac Layout Khac

| Layout Name | Widget File | Content |
|---|---|---|
| `Aura Menu Board` | `signage-widgets/menu-board.html` | Thuc don + gia / Menu + prices |
| `Aura Promo Screen` | `signage-widgets/promo-screen.html` | Khuyen mai tu dong xoay / Auto-rotating promos |
| `Aura Welcome` | `signage-widgets/welcome-screen.html` | Chao don + WiFi + loyalty info |

### 3.4 Lich Chay / Schedule (07:00 - 22:00)

1. **Schedule > Add Event**
2. **Event Type:** `Layout`, **Layout:** chon layout vua tao
3. **From:** `07:00`, **To:** `22:00`
4. **Day of Week:** 7 ngay / All days
5. **Start:** hom nay, **End:** khong dat / today, no end date
6. **Save**

### 3.5 Gan Layout cho Display

1. **Display > Displays** > chon "Aura Cafe Menu Screen"
2. Tab **Layouts** > **Assign Layout** > chon layout > **Save**

---

## 4. 🔌 Ket Noi TV va Khoi Chay

### 4.1 Ket Noi Vat Ly / Physical Setup

```
[Raspberry Pi] --HDMI cable--> [TV]
       |
      WiFi/LAN
       |
[Xibo CMS Server]
```

- **Cam HDMI** tu Raspberry Pi vao TV
- **Chon nguon HDMI** bang remote TV
- **Cam dien** cho Raspberry Pi

### 4.2 Kiem Tra / Verify

```bash
# Tu Raspberry Pi, kiem tra ket noi CMS
curl -I http://[CMS-IP]:8080  # Phai thay "200 OK"

# Kiem tra Xibo Player
sudo systemctl status xibo-player.service  # Phai "active (running)"

# Kiem tra Internet
ping -c 3 google.com
```

### 4.3 Cau Hinh Mang / Network

| Truong hop / Scenario | Cach dat / Configuration |
|---|---|
| **Cung mang LAN** (de nhat) | Dung IP noi bo (192.168.x.x) — khong can mo cong |
| **Qua Internet** (VPS) | Mo cong 8080: `sudo ufw allow 8080/tcp` |
| **Co domain** | Dung Nginx/Caddy reverse proxy + HTTPS |

---

## 5. 🔧 Xu Ly Su Co / Troubleshooting

### "CMS not reachable"

| Nguyen nhan | Cach xu ly |
|---|---|
| Sai mang WiFi | `ping [CMS-IP]` tu Raspberry Pi |
| Container khong chay | `docker ps` tren may chu |
| Firewall chan | `sudo ufw status` — mo 8080 |
| Sai URL trong config.json | Kiem tra `cmsUrl` tren Raspberry Pi |

### Man hinh trang / White screen

| Nguyen nhan | Cach xu ly |
|---|---|
| Display Key sai | Vao CMS > Displays > copy lai key |
| Layout chua gan | Vao CMS > Display > Assign Layout |
| Xem log player | `sudo journalctl -u xibo-player.service -n 50` |

### Widget khong cap nhat / Not updating

| Nguyen nhan | Cach xu ly |
|---|---|
| API_BASE URL sai trong widget | Mo widget trong CMS > kiem tra URL goi API |
| Player khong Internet | `ping google.com` tu Raspberry Pi |
| API worker bi loi | `curl https://fnb-caffe-container.pages.dev/api/health` |

### Container khong khoi dong / Won't start

| Nguyen nhan | Cach xu ly |
|---|---|
| Cong 8080 da dung | Doi `CMS_PORT` (vi du 9090) |
| Quyen data MySQL | `sudo chown -R 999:999 ./data/mysql` |
| Xem log | `docker compose logs cms-web | tail -30` |

### Lenh huu ich / Useful commands

```bash
# Xem log Xibo Player
sudo journalctl -u xibo-player.service -f -n 50

# Khoi dong lai Xibo Player
sudo systemctl restart xibo-player.service

# Khoi dong lai Xibo CMS
cd ~/xibo-docker-4.4.3 && docker compose restart

# Khoi dong lai Raspberry Pi
sudo reboot

# Xem IP cua Raspberry Pi
hostname -I
```

> **📌 Ghi Nho / Remember**
> 1. Doi mat khau admin CMS ngay sau lan dang nhap dau tien (Change admin password immediately)
> 2. Dat gio VN (Asia/Ho_Chi_Minh) de lich chay dung gio (Set Vietnam timezone for correct schedules)
> 3. Luon giu SD card backup cua Raspberry Pi (Always keep a backup SD card)
> 4. Widget files nam trong `signage-widgets/` cua du an (Widget files are in the project's `signage-widgets/`)
