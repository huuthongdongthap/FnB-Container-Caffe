# 01 · Client Needs Analysis

**Client**: AURA SPACE — Container Rooftop Café Sa Đéc
**Date**: 2026-05-07
**Deal**: Chương trình khuyến mãi thường niên + khai trương + loyalty-cashback

---

## A. Client Profile

| Field | Value |
|-------|-------|
| **Tên** | AURA SPACE by Mekong Agency |
| **Loại hình** | F&B — Café container rooftop |
| **Địa điểm** | 123 Nguyễn Huệ, Sa Đéc, Đồng Tháp |
| **Quy mô** | 10 bàn, 4 khu vực (Ground / Rooftop / Courtyard / Bar) |
| **Giai đoạn** | Chưa khai trương — pre-launch |
| **Website** | auracafe.vn (Cloudflare Pages) |
| **Stack** | HTML5/CSS/JS + Cloudflare Workers + D1 |
| **Giá trung bình** | 40-65,000₫ / món |

---

## B. Pain Points

| # | Pain | Impact |
|---|------|--------|
| 1 | **Thương hiệu mới** — chưa có nhận diện tại Sa Đéc | Khó thu hút khách, phụ thuộc vào passersby |
| 2 | **Không có hệ thống giữ chân KH** — KH uống 1 lần rồi quên | Mất revenue dài hạn, phải liên tục tìm KH mới |
| 3 | **Chưa có chương trình khuyến mãi** — chỉ có ô nhập code ở checkout | Không có lý do để KH quay lại hoặc giới thiệu |
| 4 | **Cạnh tranh local** — nhiều quán cà phê giá rẻ khu vực | Phải có USP rõ ràng ngoài không gian |
| 5 | **Không có data KH** — không biết ai đang uống, tần suất, sở thích | Không segment được, marketing mù mờ |

---

## C. Goals & Objectives

| Priority | Goal | Target (30 ngày) |
|----------|------|------------------|
| 🔴 P0 | Thu hút KH mới — đạt 500 first-time customers | 500 KH |
| 🟡 P1 | Kích hoạt loyalty — 400 sign-ups | 400 sign-ups (80% conversion) |
| 🟡 P1 | Tạo repeat purchases — 150 KH quay lại ≥2 lần | 150 repeat |
| 🟢 P2 | Xây dựng UGC — 80 review + content từ KH | 80 reviews/UGC |
| 🟢 P2 | Doanh thu target — 27-45M₫ tháng đầu | 27-45M₫ |

---

## D. Constraints

| Constraint | Detail |
|------------|--------|
| **Budget** | 15,000,000₫ cứng — không thể vượt |
| **Timeline** | 30 ngày (08/05 — 07/06/2026) |
| **Team** | 1 barista + 1 quản lý — không có team marketing |
| **Tech** | Hệ thống đã có API promotions + loyalty, cần seed data + UI |

---

## E. Success Criteria

1. **KH mới**: ≥500 người trong 30 ngày
2. **Loyalty conversion**: ≥80% KH mới đăng ký
3. **ROAS**: ≥2x (revenue / budget ≥ 30M₫ / 15M₫)
4. **Review**: ≥30 Google Maps review 5★
5. **Repeat rate**: ≥30% KH quay lại trong 30 ngày

---

## F. Decision Matrix — Why Loyalty + Promo Combo?

| Option | Cost | Retention | Data | Complexity | Score |
|--------|------|-----------|------|------------|-------|
| Chỉ giảm giá đơn thuần | Thấp | 0 | 0 | Thấp | 2/5 |
| Chỉ loyalty points | Trung bình | ⭐⭐⭐ | ⭐⭐⭐ | Trung bình | 3/5 |
| **Promo codes + Loyalty cashback** | **Trung bình** | **⭐⭐⭐⭐⭐** | **⭐⭐⭐⭐** | **Trung bình** | **5/5** ✅ |
| Membership trả phí | Cao | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Cao | 4/5 |

**Chọn**: Promo codes (khai trương) + Loyalty cashback (thường niên) — tận dụng hệ thống đã có sẵn, chi phí triển khai thấp nhất, ROI cao nhất.
