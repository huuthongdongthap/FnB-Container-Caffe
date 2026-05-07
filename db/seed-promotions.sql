-- =====================================================
-- AURA SPACE — Seed Promotions (11 mã khai trương)
-- Campaign: "AURA GRAND OPENING — Uống Là Có Lời"
-- Date: 2026-05-07
-- Run: wrangler d1 execute fnb-caffe-db --remote --file=db/seed-promotions.sql
-- =====================================================

-- Xoá codes cũ nếu có (để re-run an toàn)
DELETE FROM promotions WHERE code IN (
  'GRANDOPEN25','FIRSTORDER','TIKTOK15','INSTA15','WELCOME50',
  'WEEKEND20','MONDAYBOOST','DUO20','THANKYOU15','ACOUSTIC20','VIPFIRST'
);

INSERT INTO promotions (code, percent, min_order, max_discount, usage_limit, usage_count, starts_at, expires_at, is_active)
VALUES
  -- ═══ KHÁCH MỚI ═══
  ('GRANDOPEN25',  25, 0,      50000, 200, 0, '2026-05-08T00:00:00Z', '2026-05-14T23:59:59Z', 1),
  ('FIRSTORDER',   20, 0,      30000, 300, 0, '2026-05-08T00:00:00Z', '2026-06-07T23:59:59Z', 1),
  ('TIKTOK15',     15, 50000,  25000, 200, 0, '2026-05-08T00:00:00Z', '2026-06-07T23:59:59Z', 1),
  ('INSTA15',      15, 50000,  25000, 100, 0, '2026-05-08T00:00:00Z', '2026-06-07T23:59:59Z', 1),
  ('WELCOME50',    50, 0,      40000, 100, 0, '2026-05-08T00:00:00Z', '2026-05-21T23:59:59Z', 1),

  -- ═══ KHÁCH CŨ / RETENTION ═══
  ('THANKYOU15',   15, 0,      30000, 500, 0, '2026-05-15T00:00:00Z', '2026-06-07T23:59:59Z', 1),
  ('WEEKEND20',    20, 100000, 30000, 200, 0, '2026-05-08T00:00:00Z', '2026-06-07T23:59:59Z', 1),
  ('MONDAYBOOST',  0,  0,      0,     NULL, 0, '2026-05-08T00:00:00Z', '2026-06-07T23:59:59Z', 1),
  ('ACOUSTIC20',   20, 150000, 50000, 100, 0, '2026-05-31T00:00:00Z', '2026-05-31T23:59:59Z', 1),

  -- ═══ COMBO + VIP ═══
  ('DUO20',        10, 100000, 20000, 150, 0, '2026-05-08T00:00:00Z', '2026-06-07T23:59:59Z', 1),
  ('VIPFIRST',     10, 0,      30000, 50,  0, '2026-05-24T00:00:00Z', '2026-06-07T23:59:59Z', 1);

-- Verify
SELECT code, percent, min_order, max_discount, usage_limit, is_active FROM promotions ORDER BY starts_at;
