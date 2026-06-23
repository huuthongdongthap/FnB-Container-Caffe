---
date: 2025-06-19
version: 1.0
status: stable
---

# FOUNDER MANIFESTO — AURA CAFE CONTAINER

## Vision

**"Where Flavor Meets Design"** — Nơi ẩm thực F&B đương đại giao thoa với kiến trúc container industrial-luxury tại Sa Đéc, Đồng Tháp, tạo nên không gian cà phê đa trải nghiệm: từ coworking đến sự kiện, từ ẩm thực đến công nghệ.

---

## Mission

Xây dựng một hệ thống quản lý F&B container-toàn diện **tự chủ về công nghệ**, **tối ưu chi phí** (90% tiết kiệm so với SaaS), và **bám sát phong thủy Bát tự** của Nhật chủ, đồng thời mang đến trải nghiệm khách hàng premium với thiết kế Cyberpunk-Neon đậm chất Sadec.

---

## Core Values

### 1. Open Source First
Sử dụng 100% phần mềm mã nguồn mở cho 12 trụ cột công nghệ (Odoo, Cal.com, Home Assistant, Frigate...). Dữ liệu do chúng ta tự làm chủ 100% — không phụ thuộc vendor lock-in.

### 2. Cost Optimization
Chi phí vận hành ~700.000 VND/tháng (hosting, domains) thay vì hàng chục triệu cho các SaaS. Mọi đồng vốn đầu tư vào technology là đầu tư vào tài sản số.

### 3. Bazi-Aligned Design
Thiết kế tuân thủ Bát tự Nhật chủ (壬 Thủy Dương) với tông màu Navy/Chrome/Mộc, cấm tuyệt đối Hỏa & Thổ. Tất cả UI/UX phải có rationale phong thủy rõ ràng.

### 4. Self-Hosted Sovereignty
Chạy hoàn toàn trên Cloudflare Free Tier (Workers + D1 + KV). Không cần server vật lý. Tự chủ về uptime, backup, security.

### 5. Local Context
Sa Đéc, Đồng Tháp là nơi triển khai. Thiết kế phải bám sát văn hóa địa phương, ngôn ngữ tiếng Việt là chính, và tôn trọng đặc thù F&B Việt Nam.

### 6. Continuous Improvement
Không bao giờ dừng lại ở "production ready". Mỗi sprint là cơ hội để audit, refactor, và nâng cấp experience.

---

## Founding Principles

### Technology Stack Lock
- **Frontend:** Static HTML + Vite (no React/Vue overhead)
- **Backend:** Cloudflare Workers (Hono framework)
- **Database:** D1 (SQLite compatible)
- **Testing:** Jest + Playwright (80% coverage threshold)
- **Deployment:** Cloudflare Pages (GitHub integration)

### Security by Default
- JWT authentication với rate limiting
- Audit logging cho mọi admin actions
- CORS allowlist nghiêm ngặt
- Secrets trong Wrangler secrets, không hardcode

### Documentation as Code
Tất cả tài liệu quan trọng trong `/docs/` với cấu trúc chuẩn (12-docs template). README.md phải luôn up-to-date.

### Business Integration
Hệ thống được thiết kế để integrate với 12 pillars OSS:
1. Odoo (POS/ERP/CRM)
2. Cal.com (Coworking scheduling)
3. OpenWISP (WiFi captive portal)
4. pretix (Event ticketing)
5. TastyIgniter (Online ordering)
6. Xibo/Anthias (Digital signage)
7. Mautic (Email marketing)
8. Home Assistant (IoT)
9. Frigate (AI CCTV)
10. VNPay/MoMo/SePay (Payment gateways)
11. Mixpost (Social media)
12. Email servers (SMTP)

---

## Target Audience

### Primary
- **Chủ doanh nghiệp** (Nguyễn Hữu Còn) — cần system dễ quản lý, thông minh, tiết kiệm chi phí.
- **Nhân viên quán** — cần giao diện đơn giản, nhanh, ít training.
- **Khách hàng** — trải nghiệm ordering, loyalty, reservation mượt mà, hiện đại.

### Secondary
- **Developer team** (Mekong CLI) — cần architecture rõ ràng, testable, maintainable.
- **Auditors/Compliance** — cần audit trail, security logs, data lineage.

---

## Long-term Aspiration (5-10 years)

1. **Year 1-2:** Production stable, all 12 pillars integrated, 5.000+ customers, 10.000+ orders/month.
2. **Year 3-5:** Expand to multi-location franchise model (additional containers in other cities), AI-powered demand forecasting (integrate LLM agents), full POS/ERP sync with Odoo.
3. **Year 5-10:** Self-sustaining F&B ecosystem — từ production đến distribution, tất cả tự chủ trên open source stack. No SaaS dependencies. Data-driven insights từ years of customer behavior.

---

## Phong Thủy Commitment

**Bazi của Nhật chủ (壬 Thủy Dương):**
- **Thủy (Water)** là chủ đối — tông màu đậm: Navy (#0A1A2E), Ocean (#1A2A4E), Abyss (#050D1A)
- **Kim (Metal)** sinh Thủy — accents: Chrome (#C9D6DF), Steel Blue (#3A6B80), Silver (#6B9FB8)
- **Mộc (Wood)** cân bằng — zoning colors: Forest (#1A2D1F), Jade (#4A7C59), Moss (#A8C5A0)

**Cấm kỵ tuyệt đối:**
- **Hỏa (Fire):** Gold, Orange, Red (#FFD700, #FF6B35, #FF1744)
- **Thổ (Earth):** Brown, Khaki, Earth tones (#8B4513, #C9A200, #C9A962)

Mọi design decision phải có rationale trở về một trong ba yếu tố trên.

---

**Ký xác nhận:** Founder, Nhật chủ Nguyễn Hữu Còn  
**Ngày hiệu lực:** 2026-06-04 (CEO Handover date)  
**Cập nhật lần cuối:** 2025-06-19 (docs conversion)

---

*Tài liệu nền tảng — Đọc trước 01_GOAL.md và 03_ARCHITECTURE.md.*
