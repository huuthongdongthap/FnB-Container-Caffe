-- Migration: Thêm 3 SKU trà sữa cho pilot test Gen Z (học sinh 11-12)
-- Date: 2026-05-30
-- Strategy: Insert với is_available=0 (HIDDEN từ menu) — anh activate khi quyết định sau pre-launch test
--
-- Pilot timeline:
--   T3 2/6 - T6 5/6: Pre-launch test, Cường pha tay, tracking 32 em
--   T6 5/6 tối: Anh quyết → 1 SQL UPDATE activate SKU nào cần
--   T7 6/6 D-Day: SKU active sẵn sàng bán
--
-- Idempotent: dùng INSERT OR IGNORE, safe re-run

-- ============================================================================
-- Section 1: Add 3 pilot SKUs (HIDDEN by default)
-- ============================================================================

-- SKU 1: Base — Trà sữa trân châu 20k
INSERT OR IGNORE INTO products (id, name, price, description, is_available, category_id) VALUES
('PROD_TS_TC_BASE',
 'Trà sữa trân châu',
 20000,
 'Trà Lipton ngâm đặc + sữa đặc + 80g trân châu đen + đá. Giá sinh viên ✨',
 0,
 NULL);

-- SKU 2: Topping upgrade — Thêm trân châu (deluxe)
INSERT OR IGNORE INTO products (id, name, price, description, is_available, category_id) VALUES
('PROD_TS_TC_DELUXE',
 'Trà sữa trân châu (deluxe)',
 23000,
 'Như trà sữa trân châu base + thêm 50g trân châu (tổng 130g). Cho fan trân châu 🧋',
 0,
 NULL);

-- SKU 3: Topping cream — Whipping cream (Rich)
INSERT OR IGNORE INTO products (id, name, price, description, is_available, category_id) VALUES
('PROD_TS_TC_CREAM',
 'Trà sữa trân châu + whipping cream',
 25000,
 'Trà sữa trân châu base + topping whipping cream Rich + rắc cacao. Vibe Phúc Long ☁️',
 0,
 NULL);

-- ============================================================================
-- Section 2: Verification queries
-- ============================================================================

-- Sau migration apply, verify 3 rows added:
--   SELECT id, name, price, is_available FROM products WHERE id LIKE 'PROD_TS_TC_%';
--
-- Expected (all is_available=0):
--   PROD_TS_TC_BASE        | Trà sữa trân châu                       | 20000 | 0
--   PROD_TS_TC_DELUXE      | Trà sữa trân châu (deluxe)              | 23000 | 0
--   PROD_TS_TC_CREAM       | Trà sữa trân châu + whipping cream      | 25000 | 0

-- ============================================================================
-- Section 3: ACTIVATE commands (chạy sau khi quyết định)
-- ============================================================================

-- Activate chỉ SKU base (Phase 1 D-Day):
--   UPDATE products SET is_available=1 WHERE id='PROD_TS_TC_BASE';

-- Activate tất cả 3 SKU (Phase 2 sau D-Day nếu pilot success):
--   UPDATE products SET is_available=1 WHERE id LIKE 'PROD_TS_TC_%';

-- Activate chỉ base + deluxe (skip cream nếu phản ứng yếu):
--   UPDATE products SET is_available=1 WHERE id IN ('PROD_TS_TC_BASE', 'PROD_TS_TC_DELUXE');

-- ============================================================================
-- Section 4: Rollback (DEACTIVATE)
-- ============================================================================

-- Tắt tất cả 3 SKU:
--   UPDATE products SET is_available=0 WHERE id LIKE 'PROD_TS_TC_%';

-- Xoá hoàn toàn (chỉ làm sau pilot nếu quyết định bỏ):
--   DELETE FROM products WHERE id LIKE 'PROD_TS_TC_%';
