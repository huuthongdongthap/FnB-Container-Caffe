-- =====================================================
-- AURA SPACE — Seed Promotions (Correct Opening Codes)
-- Campaign: "AURA GRAND OPENING — Uống Là Có Lời"
-- Run: wrangler d1 execute fnb-caffe-db --remote --file=db/seed-promotions.sql
-- =====================================================

-- Xoá codes cũ nếu có
DELETE FROM promotions;

INSERT INTO promotions (code, percent, min_order, max_discount, usage_limit, usage_count, starts_at, expires_at, is_active)
VALUES
  ('AURA20',  20, 0, 50000, 0, 0, '2026-06-06T00:00:00Z', '2026-06-06T23:59:59Z', 1),
  ('AURA10',  10, 0, 30000, 0, 0, '2026-06-07T00:00:00Z', '2026-06-13T23:59:59Z', 1),
  ('WELCOME', 10, 0, 30000, 0, 0, NULL,                  NULL,                  1);

-- Verify
SELECT code, percent, min_order, max_discount, usage_limit, is_active FROM promotions;
