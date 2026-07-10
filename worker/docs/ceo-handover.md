# 🍽️ Bàn Giao CEO — FnB Container Caffe

## 1. Tổng Quan Hệ Thống / System Overview

> **Hệ thống gọi món & thanh toán online cho quán caffe.**
> Khách chọn món → tạo đơn → thanh toán qua PayOS → quầy nhận đơn → chế biến → giao hàng.

| Thành phần | URL | Mô tả |
|-----------|-----|-------|
| Worker (API) | `https://aura-space-worker.agencyos-openclaw.workers.dev` | Backend xử lý đơn, thanh toán, webhook |
| Thanh toán | PayOS | Nhận tiền từ khách, xác nhận tự động qua webhook |
| Database | Cloudflare D1 | Lưu đơn hàng, khách hàng, thanh toán |
| Admin panel | Yêu cầu đăng nhập owner | Xem đơn, xử lý hoàn tiền |

---

## 2. Luồng Kinh Doanh Chính / Main Business Flows

### 📝 2.1 Khách Tạo Đơn + Thanh Toán

```
1. Khách chọn món → bấm "Thanh Toán"
2. Hệ thống gọi POST /api/payment/create-link
3. PayOS trả link thanh toán (QR/VNPAY/ZALOPAY)
4. Khách quét QR → thanh toán
5. PayOS gửi webhook → hệ thống cập nhật trạng thái đơn → "đã thanh toán"
```

**Điểm quan trọng:**
- Hệ thống tự nhận tiền — CEO không cần confirm thủ công
- Hóa đơn tự động gửi Telegram cho bếp/kết toán

### 👨‍💼 2.2 Owner Xử Lý Đơn

```
1. Đăng nhập admin (owner account)
2. Vào /api/orders → xem danh sách đơn
3. Chuyển trạng thái: pending → preparing → ready → completed
4. Nếu cần hoàn tiền: POST /api/payments/refund
```

**Trạng thái đơn hàng:**
| Status | Nghĩa |
|--------|------|
| pending | Khách đã tạo, chưa thanh toán |
| paid | Đã thanh toán, chờ làm |
| preparing | Đang chế biến |
| ready | Sẵn sàng giao |
| completed | Hoàn thành |
| cancelled | Đã hủy |

### 🔔 2.3 Xử Lý Khi Có Lỗi

| Vấn đề | Kiểm tra | Cách xử lý |
|---------|---------|------------|
| Khách không thấy link thanh toán | Xem log webhook → /api/webhook/health | PayOS secret chưa đúng? |
| Đơn stuck > 15 phút | Xem /api/admin/payments/stuck | Chuyển trạng thái thủ công |
| Khách yêu cầu hoàn tiền | POST /api/payments/refund với `paymentId` + `amount` + `reason` | Xác nhận → hệ thống hoàn tự động qua PayOS |

---

## 3. Endpoint Quan Trọng / Key API Endpoints

> **Chỉ Owner mới dùng được các endpoint có `requireAuth(['owner'])`**

| Method | Endpoint | Mục đích |
|--------|----------|---------|
| GET | `/api/health` | Kiểm tra hệ thống sống không |
| GET | `/api/version` | Xem phiên bản đang chạy |
| POST | `/api/payment/create-link` | Tạo link thanh toán cho đơn |
| POST | `/api/payments/refund` | Hoàn tiền |
| GET | `/api/admin/orders` | Xem tất cả đơn hàng |
| GET | `/api/admin/payments/stuck` | Đơn bị kẹt (SLA > 15 phút) |

---

## 4. Secrets Cần Cấu Hình / Required Secrets

```bash
# Chạy 1 lần khi deploy lần đầu:
wrangler secret put JWT_SECRET
wrangler secret put PAYOS_CLIENT_ID
wrangler secret put PAYOS_API_KEY
wrangler secret put PAYOS_CHECKSUM_KEY
```

> ⚠️ **Không commit secrets vào Git.** Secrets lưu trên Cloudflare, không hiển thị trong code.

---

## 5. Checklist Nghiệm Thu / Acceptance Checklist

### ✅ Đã Hoàn Thành
- [x] 1246 tests / 0 failures (quality gate closed)
- [x] Worker deployed: `aura-space-worker.agencyos-openclaw.workers.dev`
- [x] Payment flow (PayOS): create-link + webhook + refund implemented
- [x] CORS restricted to known origins (secure)
- [x] D1 database + KV namespace configured
- [x] Cron trigger active (SLA check every 5 min)

### ⏳ Cần Làm Trước Khi Handover
- [ ] Custom domain mapping (`auraspace.cafe` → worker)
- [ ] PayOS sandbox dry-run: tạo đơn thật → thanh toán test → nhận webhook
- [ ] Test hoàn tiền end-to-end
- [ ] Telegram alert cho SLA overdue đã active?
- [ ] Backup D1 database trước khi live

---

## 6. Rollback / Khẩn Cấp

**Nếu hệ thống gặp vấn đề:**
```bash
cd /Users/macbook/FnB-Container-Caffe/worker
git revert <commit-hash>
bash deploy-with-sha.sh
```

**Liên hệ:**
- Developer: Xem git log + commit history
- Cloudflare: Dashboard → Workers → aura-space-worker

---

## 7. Monitoring / Theo Dõi

| Công cụ | Link | Mục đích |
|---------|------|---------|
| Worker logs | CF Dashboard → Workers → Logs | Xem lỗi runtime |
| D1 queries | CF Dashboard → D1 → Console | Kiểm tra dữ liệu đơn |
| Payment stuck | `/api/admin/payments/stuck` | Đơn bị kẹt thanh toán |

---

*Generated: 2026-07-10 | Commit: `61bfad3` | Worker: `aura-space-worker`*
