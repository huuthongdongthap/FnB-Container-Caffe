# BRAINSTORM REPORT: UI/UX AURA CAFE CODEBASE REVIEW & MD3 ALIGNMENT

**Date:** 2026-09-17  
**Context:** `/mk-brainstorm review code base để tiếp tục điều chỉnh UI UX AURA CAFE`  
**Target Subsystem:** `src/components/stitch/`, `src/pages/menu.tsx`, `src/components/md3/`  

---

## 1. Brainstorm Contract

| Field | Definition | Specifics for AURA CAFE UI/UX |
|---|---|---|
| **Outcome** | Standardized Customer UI | Chuyển đổi toàn diện các thẻ sản phẩm và điều khiển tương tác trên Digital Menu (`/menu`) tuân thủ nghiêm ngặt **Material Design 3 Strict Mode** (`.claude/rules/m3-strict.md`) song song với việc giữ vững phong cách **Industrial Luxury** (Dark Navy `#0A1A2E`, Surface `#0d1b2a`, Soft Steel `#b8c7e2`, Bronze Gold `#d4a574`). |
| **Constraints** | Compatibility & Quality | - Không thêm third-party UI library mới (tái sử dụng 100% `src/components/md3/`).<br>- Giữ nguyên Zustand store (`useMenuStore`, `useCart`) và contract `@aura/domain-*`.<br>- Tuân thủ giới hạn file < 200 LOC per file.<br>- Test suite giữ nguyên trạng thái green (362 files / 3297 tests). |
| **Non-goals** | Out of Scope | - Không chỉnh sửa backend D1 schema, KDS logic, hoặc POS reconciliations (đã chốt ở M2/M3).<br>- Không đụng vào `.pen` files (dành riêng cho Pencil/Antigravity design mode).<br>- Không viết lại toàn bộ luồng cart/checkout trong đợt này. |
| **Acceptance Criteria** | Measurable Evidence | 1. Thẻ món ăn (`StitchMenuNewMenuCard`) sử dụng `<MD3Card variant="elevated">`.<br>2. CTA thêm món sử dụng `<MD3Button variant="filled">`.<br>3. Toàn bộ hardcoded colors được quy chuẩn về semantic tokens `var(--md-sys-color-*)` kết hợp `aura-tokens.ts`.<br>4. Zero lint/type errors, test suite pass 100%. |

---

## 2. Codebase Audit & Evidence

1. **Routing & Entry Point (`src/pages/menu.tsx`)**:
   - Khởi tạo route `/menu` mount `StitchMenuNew`.
   - Kết nối trực tiếp với `useMenuStore`, `useCart`, `CartDrawer`, và `RecommendationSection`.
   - Category mapping đã chuẩn hoá: `CATEGORY_MAP` map danh mục Viva Star sang 4 nhóm chính (`coffee`, `tea`, `cold-brew`, `signature`).

2. **Component Thẻ Món (`src/components/stitch/StitchMenuNew-menu-card.tsx`)**:
   - Đang dùng raw tag `<article className="... rounded-xl aura-glass">`.
   - Nút Add to Cart dùng raw `<button>` với inline gradient classes.
   - Vi phạm `.claude/rules/m3-strict.md` (yêu cầu `<MD3Card>` & `<MD3Button>`).

3. **Thư Viện MD3 Sẵn Có (`src/components/md3/`)**:
   - `MD3Card` (`src/components/md3/md3-card.tsx`): Hỗ trợ variants `elevated`, `filled`, `outlined`, xử lý ripple và elevation token chuẩn MD3.
   - `MD3Button` (`src/components/md3/md3-button.tsx`): Đầy đủ variants `filled`, `outlined`, `text`, `elevated`, `tonal`.

---

## 3. Options Trade-off Analysis

| Tiêu chí | Tiếp cận 1: In-place Refactor sang MD3 Primitives (Khuyên dùng) | Tiếp cận 2: Tạo Wrapper Adapter `AuraMD3Card` | Tiếp cận 3: Rewrite toàn bộ Stitch sang MD3 AppShell |
|---|---|---|---|
| **Mô tả** | Refactor trực tiếp `StitchMenuNewMenuCard.tsx` thay `<article>` bằng `<MD3Card variant="elevated">` và `<button>` bằng `<MD3Button>`. Giữ nguyên props interface `MenuItemData`. | Tạo 1 wrapper trung gian mapping Stitch props sang MD3 props để giữ nguyên code cũ không đổi. | Thay thế toàn bộ layout `StitchMenuNew` bằng `MD3AppShell` và các container mới. |
| **Ưu điểm** | - Tuân thủ YAGNI, KISS, DRY.<br>- File dưới 150 LOC.<br>- Không tạo technical debt hoặc wrapper thừa.<br>- Tương thích 100% với data store hiện tại. | - Ít chạm vào file cũ, giảm thiểu rủi ro diff lớn. | - Đồng bộ 100% kiến trúc layout hệ thống. |
| **Nhược điểm** | - Cần test lại visual snapshot của card. | - Vi phạm DRY và KISS (thêm layer gián tiếp).<br>- Tăng số lượng file bảo trì. | - Scope quá lớn, dễ gây regression sang các màn hình khác trong M4. |
| **Độ rủi ro** | Thấp | Trung bình | Cao |

---

## 4. Recommendation: Tiếp cận 1 (Smallest Viable Approach)

- **Bước 1**: Nhúng `MD3Card` (`variant="elevated"`) vào `StitchMenuNewMenuCard.tsx`.
- **Bước 2**: Nhúng `MD3Button` (`variant="filled"`) cho CTA "Thêm vào giỏ" / "Đã thêm".
- **Bước 3**: Đồng bộ color tokens sang `--md-sys-color-surface-container-low` và `--md-sys-color-primary` với accent Dark Navy/Bronze của AURA.
- **Bước 4**: Chạy `npm run test` và `npx tsc --noEmit` xác thực.

---

## 5. Unresolved Questions
- Không có blocker kỹ thuật. Sẵn sàng nhận lệnh chuyển sang `/mk:plan` hoặc `/mk:cook`.
