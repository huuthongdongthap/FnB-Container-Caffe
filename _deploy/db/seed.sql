-- AURA SPACE — Seed Data (SQLite / Cloudflare D1)
-- Run after schema.sql

-- ─────────────────────────────────────────────
-- CATEGORIES
-- ─────────────────────────────────────────────
INSERT OR IGNORE INTO categories (id, name, description) VALUES
  ('cat-001', 'Cà Phê',         'Espresso, Pour-over, Cold Brew từ hạt Arabica nguyên chất'),
  ('cat-002', 'Trà & Nước Ép',  'Trà ô long, matcha, nước ép trái cây tươi'),
  ('cat-003', 'Signature Drinks','Đồ uống đặc biệt chỉ có tại AURA SPACE'),
  ('cat-004', 'Đồ Ăn Nhẹ',     'Bánh mì, croissant, snack kèm cà phê');

-- ─────────────────────────────────────────────
-- PRODUCTS
-- ─────────────────────────────────────────────
INSERT OR IGNORE INTO products (id, category_id, name, price, description, is_available) VALUES
  -- Cà Phê
  ('prod-001', 'cat-001', 'Espresso',            35000, 'Espresso đậm đà, chiết xuất 25ml từ hạt Arabica Buôn Mê Thuột', 1),
  ('prod-002', 'cat-001', 'Cappuccino',           45000, 'Espresso + steamed milk + milk foam theo tỉ lệ chuẩn Ý', 1),
  ('prod-003', 'cat-001', 'Cà Phê Sữa Đá',       35000, 'Phin truyền thống với sữa đặc, đá viên', 1),
  ('prod-004', 'cat-001', 'Cold Brew',            55000, 'Ngâm lạnh 18 giờ, vị ngọt tự nhiên, ít chua', 1),
  ('prod-005', 'cat-001', 'Flat White',           50000, 'Double ristretto + microfoam sữa tươi, ít bọt', 1),

  -- Trà & Nước Ép
  ('prod-011', 'cat-002', 'Trà Ô Long Đào',      45000, 'Ô long thượng hạng pha cùng đào tươi và thạch', 1),
  ('prod-012', 'cat-002', 'Matcha Latte',         55000, 'Matcha Uji Nhật Bản + sữa tươi nguyên kem', 1),
  ('prod-013', 'cat-002', 'Nước Ép Cam Tươi',    40000, 'Cam Việt Nam vắt tươi tại chỗ', 1),
  ('prod-014', 'cat-002', 'Trà Chanh Muối',      35000, 'Đặc sản miền Tây, vị chua mặn ngọt hài hòa', 1),

  -- Signature Drinks
  ('prod-021', 'cat-003', 'AURA Rooftop Cooler', 65000, 'Butterfly pea + lemon + soda, đổi màu xanh tím huyền ảo', 1),
  ('prod-022', 'cat-003', 'Sa Đéc Sunset',       60000, 'Passion fruit + mango + coconut cream, màu hoàng hôn', 1),
  ('prod-023', 'cat-003', 'Industrial Shake',    70000, 'Chocolate đen + cold brew + caramel + whipped cream', 1),

  -- Đồ Ăn Nhẹ
  ('prod-031', 'cat-004', 'Croissant Bơ Pháp',   35000, 'Croissant lớp bơ Pháp, nướng nóng mỗi sáng', 1),
  ('prod-032', 'cat-004', 'Bánh Mì Phô Mai',     40000, 'Bánh mì Việt nhân phô mai mozzarella nóng chảy', 1),
  ('prod-033', 'cat-004', 'Tiramisu',            55000, 'Tiramisu kiểu Ý, mascarpone + espresso sponge', 1);

-- ─────────────────────────────────────────────
-- TABLES (10 bàn — Ground / Rooftop / Courtyard)
-- ─────────────────────────────────────────────
INSERT OR IGNORE INTO cafe_tables (id, table_number, capacity, zone, status) VALUES
  -- Ground floor (container chính)
  ('tbl-001', 'G01', 2, 'Ground',    'Available'),
  ('tbl-002', 'G02', 2, 'Ground',    'Available'),
  ('tbl-003', 'G03', 4, 'Ground',    'Available'),
  ('tbl-004', 'G04', 4, 'Ground',    'Available'),
  ('tbl-005', 'G05', 6, 'Ground',    'Available'),

  -- Rooftop (phòng kính + sân trống)
  ('tbl-006', 'R01', 2, 'Rooftop',   'Available'),
  ('tbl-007', 'R02', 4, 'Rooftop',   'Available'),
  ('tbl-008', 'R03', 4, 'Rooftop',   'Available'),

  -- Courtyard (sân ngoài trời)
  ('tbl-009', 'C01', 6, 'Courtyard', 'Available'),
  ('tbl-010', 'C02', 8, 'Courtyard', 'Available');

-- ─────────────────────────────────────────────
-- REWARDS (mẫu)
-- ─────────────────────────────────────────────
INSERT OR IGNORE INTO rewards (id, title, discount_type, discount_value, point_cost) VALUES
  ('rwd-001', 'Giảm 10%',           'PERCENTAGE',   10.00, 100),
  ('rwd-002', 'Giảm 20.000đ',       'FIXED_AMOUNT', 20000, 150),
  ('rwd-003', '1 Cà Phê Miễn Phí',  'FIXED_AMOUNT', 35000, 300),
  ('rwd-004', 'Giảm 50% Hóa Đơn',   'PERCENTAGE',   50.00, 500);
