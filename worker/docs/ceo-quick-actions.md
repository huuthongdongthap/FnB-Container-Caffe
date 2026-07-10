# CEO Quick Actions — Handover Brief
# 3 Bước Chuyển Giao — Tóm Tắt Cho CEO

---

## 📋 Bạn cần làm 3 việc này trước khi bàn giao hoàn tất
## 📋 Complete These 3 Steps Before Handover Is Done

---

**🔗 Step 1 — Custom Domain**
Mở Cloudflare Dashboard → chọn domain **auraspace.cafe** → tạo CNAME record trỏ đến `aura-space-worker.agencyos-openclaw.workers.dev`.
Open Cloudflare Dashboard → select domain **auraspace.cafe** → create a CNAME record pointing to `aura-space-worker.agencyos-openclaw.workers.dev`.

**💳 Step 2 — PayOS Webhook**
Mở PayOS Dashboard → vào mục Webhook → dán đường dẫn `https://aura-space-worker.agencyos-openclaw.workers.dev/api/webhook/payos` vào ô Webhook URL → lưu lại.
Open PayOS Dashboard → go to Webhook settings → paste `https://aura-space-worker.agencyos-openclaw.workers.dev/api/webhook/payos` into the Webhook URL field → save.

**🗄️ Step 3 — Database Backup**
Mở Cloudflare Dashboard → D1 → chọn database **fnb-caffe-db** → bấm **Console** → gõ lệnh `.export backup.sql` → tải file về máy.
Open Cloudflare Dashboard → D1 → select database **fnb-caffe-db** → click **Console** → type `.export backup.sql` → download the file to your computer.

---

_3 bước xong trong 6 phút. Sau đó báo lại để hoàn tất bàn giao._
_Done in 6 minutes. Report back to complete handover._
