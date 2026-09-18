# Kế hoạch Tái cấu trúc Giao diện UI (AURA FnB)

## Bối cảnh & Mục tiêu
Tái cấu trúc toàn bộ trải nghiệm người dùng frontend theo 3 tầng độc lập: **Customer**, **Operations (Bếp/KDS/TV/POS)**, và **HQ (Quản trị)**.
Bảo toàn 100% logic kinh doanh và 3,379 tests hiện có, nâng cấp từ cấu trúc layout nguyên khối `StitchAppLayout` sang kiến trúc **Multi-Shell M3 + Industrial Luxury**.

---

## Danh mục các Pha Thực thi

| Pha | Tên Pha | Nội dung chính | Trạng thái |
|:---:|---|---|:---:|
| **01** | [Shell Architecture](./phase-01-shell-architecture.md) | Tách 3 Experience Shells: `CustomerShell`, `OpsShell`, `AdminShell` | Sẵn sàng |
| **02** | [Navigation & IA](./phase-02-navigation-information-architecture.md) | Tái cấu trúc 5 tabs khách hàng, cô lập KDS/TV khỏi CartBottomBar | Sẵn sàng |
| **03** | [M4-B Menu Catalog](./phase-03-m4b-digital-menu-catalog-integration.md) | Tích hợp Menu view với `@aura/domain-catalog` (`getCustomerMenu`) | Sẵn sàng |
| **04** | [Industrial Luxury Design System](./phase-04-industrial-luxury-design-system.md) | Đồng bộ Token M3, Typography, Density và Tiếng Việt chuẩn F&B | Sẵn sàng |
| **05** | [Kiểm thử & Đóng gói](./phase-05-verification-and-tests.md) | Chạy 3,379 tests vitest, E2E routing, kiểm tra bundle build | Sẵn sàng |

---

## Nguyên tắc Cốt lõi (UI-01 & UI-02)
- **KEEP**: React 18, Vite, Tailwind CSS, TanStack Query, Zustand stores, routes hiện hữu trong quá trình chuyển đổi.
- **CHANGE**: Phân định ranh giới trải nghiệm (Customer vs Ops vs Admin), tách vỏ kiến trúc Shell, chuẩn hóa 5 tab điều hướng.
- **VISUAL**: AURA Industrial Luxury (Navy `#0A1128`, Chrome `#6B9FB8`, Bronze `#D4AF37`), 8px grid, độ tương phản cao cho Ops, mật độ thông tin cao cho HQ.
