# F&B CAFFE CONTAINER — Open Source Arsenal

Tài liệu này chi tiết hóa 12 pillars (trụ cột) công nghệ nguồn mở được thiết kế để vận hành F&B CAFFE CONTAINER tại Sa Đéc, Đồng Tháp, hướng tới mô hình F&B container hiện đại với chi phí phần mềm tiệm cận 0.

## 1. 💳 POS System (Bán hàng)
**Công cụ:** Odoo POS (LGPL v3)
**Vai trò:** All-in-one platform quản lý bán hàng tại quầy (F&B), tích hợp trực tiếp với Inventory, CRM và Kế toán. Hỗ trợ chạy online/offline (bảo vệ khỏi sự cố mạng).

## 2. 🏢 Coworking Management (Quản lý workspace)
**Công cụ:** Cal.com (AGPL v3) + Odoo Members
**Vai trò:** Open scheduling cho việc đặt lịch phòng họp, mentoring sessions. Kết hợp Odoo Members để quản lý các gói Coworking Memberships.

## 3. 📶 WiFi Management (Captive Portal)
**Công cụ:** OpenWISP (GPL v3)
**Vai trò:** Quản lý hạ tầng mạng, tích hợp Captive Portal (social login, OTP) để thu thập dữ liệu khách hàng cho các chiến dịch marketing. Phân cấp băng thông cho tài khoản VIP.

## 4. 🎫 Events & Workshops (Sự kiện)
**Công cụ:** pretix (AGPL)
**Vai trò:** Hệ thống bán vé (Ticketing), check-in, quản lý lịch trình cho các coding workshops, hackathons định kỳ hằng tháng.

## 5. 📊 ERP & Accounting (Kế toán)
**Công cụ:** Odoo Accounting (LGPL v3)
**Vai trò:** Kế toán chuẩn mực (tương thích VAS - Vietnam Accounting Standards). Đặc biệt quan trọng: Tích hợp Hóa đơn điện tử (E-invoicing) bắt buộc tại VN từ 06/2025.

## 6. 🤝 CRM & Loyalty (Khách hàng)
**Công cụ:** Open Loyalty + Odoo CRM
**Vai trò:** Tích điểm, hạng thành viên, gamification cho khách hàng quay lại. Quản lý leads và sales pipeline cho các gói doanh nghiệp/tổ chức sự kiện.

## 7. 🛵 Online Ordering (Đặt hàng online)
**Công cụ:** TastyIgniter (MIT)
**Vai trò:** Website self-hosted cho phép khách tự đặt nước/đồ ăn online, không tốn % hoa hồng cho platform (như ShopeeFood/Grab). Quản lý delivery zones riêng tại Sa Đéc.

## 8. 📺 Digital Signage (Menu board)
**Công cụ:** Xibo (AGPL) & Anthias
**Vai trò:** Quản lý nội dung hiển thị trên các màn hình LED/TV quanh quán: Menu động, thông báo sự kiện, hiển thị ads tài trợ. Chạy trên Raspberry Pi.

## 9. 📱 Social Media Marketing
**Công cụ:** Mixpost (MIT) + Mautic (GPL v3)
**Vai trò:** Quản lý và lên lịch bài đăng đa nền tảng (Facebook, TikTok, LinkedIn). Mautic lo phần email marketing automation chăm sóc khách hàng.

## 10. 🌡️ IoT & Smart Building
**Công cụ:** Home Assistant (Apache 2.0)
**Vai trò:** Tự động hóa chiếu sáng, máy lạnh (HVAC), theo dõi điện năng tiêu thụ, nhiệt độ kho. Chạy trên Raspberry Pi 4. Giúp tối ưu >20% chi phí điện.

## 11. 📹 CCTV & Security
**Công cụ:** Frigate (MIT)
**Vai trò:** AI Object Detection (người/xe), phân tích mật độ khách hàng (Heatmap). Lưu trữ local, tích hợp Home Assistant, bảo mật tuyệt đối, không tốn phí cloud.

## 12. 💰 Payment Gateways (Cổng thanh toán VN)
**Công cụ:** VNPay/MoMo SDKs, SePay (VietQR)
**Vai trò:** Tích hợp trực tiếp thanh toán QR Code tĩnh/động cho mọi điểm chạm: Odoo POS, TastyIgniter, pretix. Đáp ứng tiêu chuẩn Open Banking 2025 tại Việt Nam.

---

> **Tổng chi phí duy trì phần mềm (Hosting, Domains, etc.): ~700k VND/tháng.**
> Tiết kiệm ~90% so với việc mua SaaS tương đương. Mọi dữ liệu do chúng ta tự làm chủ 100%.