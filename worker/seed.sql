-- F&B Caffe Container - Seed Data
-- Import menu items from data/menu-data.json

-- Clear existing data
DELETE FROM menu_items;

-- Insert Coffee Items (8 items)
INSERT INTO menu_items (id, category, name, price, description, tags, badge, available) VALUES
('c001', 'coffee', 'Espresso', 45000, 'Cà phê nguyên chất 100% Arabica, đậm đà, hậu vị đắng nhẹ', '["Hot/Cold", "30ml"]', 'Best Seller', 1),
('c002', 'coffee', 'Cappuccino', 55000, 'Espresso + sữa nóng đánh bọt + lớp foam dày', '["Hot", "180ml"]', NULL, 1),
('c003', 'coffee', 'Latte Art', 60000, 'Espresso + sữa tươi + nghệ thuật vẽ hình trên foam', '["Hot/Cold", "240ml"]', 'Popular', 1),
('c004', 'coffee', 'Cà Phê Sữa Đá', 35000, 'Cà phê phin truyền thống + sữa đặc + đá', '["Cold", "200ml"]', 'Vietnamese Classic', 1),
('c005', 'coffee', 'Bạc Xỉu Đá', 35000, 'Sữa nóng + foam + cà phê espresso, vị béo ngọt', '["Cold", "200ml"]', NULL, 1),
('c006', 'coffee', 'Cold Brew Tower (12h)', 55000, 'Cà phê ủ lạnh 12 giờ, vị mượt, ít axit', '["Cold", "300ml"]', 'Slow Brew', 1),
('c007', 'coffee', 'Pour Over V60', 55000, 'Cà phê single-origin pha pour-over, hương vị tinh tế', '["Hot", "200ml"]', 'Specialty', 1),
('c008', 'coffee', 'Caramel Macchiato', 55000, 'Espresso + vanilla syrup + caramel drizzle', '["Hot/Cold", "350ml"]', NULL, 1);

-- Insert Signature Drinks (7 items)
INSERT INTO menu_items (id, category, name, price, description, tags, badge, available) VALUES
('s001', 'signature', 'Container Special', 65000, 'Signature độc quyền: Espresso + tonic + cam slice', '["Cold", "300ml"]', 'Signature', 1),
('s002', 'signature', 'Dirty Matcha Latte', 55000, 'Matcha Nhật Bản + espresso double shot', '["Hot/Cold", "300ml"]', NULL, 1),
('s003', 'signature', 'Trà Sen Vàng', 45000, 'Trà sen + hạt sen + đường phèn', '["Hot/Cold", "350ml"]', NULL, 1),
('s004', 'signature', 'Kombucha Tươi', 45000, 'Trà lên men tự nhiên, tốt cho tiêu hóa', '["Cold", "300ml"]', 'Healthy', 1),
('s005', 'signature', 'Soda Chanh Bạc Hà', 40000, 'Soda tươi + chanh + bạc hà + đá', '["Cold", "300ml"]', NULL, 1),
('s006', 'signature', 'Trái Cây Nhiệt Đới', 50000, 'Xoài, dâu, thơm xay nhuyễn + sữa', '["Cold", "400ml"]', NULL, 1),
('s007', 'signature', 'Matcha Latte', 50000, 'Bột matcha Nhật + sữa tươi nóng/lạnh', '["Hot/Cold", "300ml"]', NULL, 1);

-- Insert Snacks (7 items)
INSERT INTO menu_items (id, category, name, price, description, tags, badge, available) VALUES
('k001', 'snacks', 'Bánh Mì Chả Lụa', 35000, 'Bánh mì baguette + chả lụa + đồ chua', '["Hot", "1 ổ"]', NULL, 1),
('k002', 'snacks', 'Sandwich Trứng', 40000, 'Bánh mì sandwich + trứng ốp la + xà lách', '["Hot", "1 cái"]', NULL, 1),
('k003', 'snacks', 'Croissant Bơ Pháp', 45000, 'Croissant nướng bơ Pháp, giòn tan', '["Hot", "1 cái"]', 'French Style', 1),
('k004', 'snacks', 'Granola Bowl', 55000, 'Granola + sữa chua Hy Lạp + trái cây tươi', '["Cold", "300g"]', 'Healthy', 1),
('k005', 'snacks', 'Cookie Choco Chip', 30000, 'Cookie nướng giòn với sô cô la chip', '["Hot", "2 cái"]', NULL, 1),
('k006', 'snacks', 'Cheesecake Slice', 55000, 'Cheesecake New York slice, béo ngậy', '["Cold", "1 slice"]', NULL, 1),
('k007', 'snacks', 'Khoai Tây Chiên', 45000, 'Khoai tây chiên giòn + sốt cà chua/mayo', '["Hot", "100g"]', NULL, 1);

-- Insert Combo Items (4 items)
INSERT INTO menu_items (id, category, name, price, description, tags, badge, available) VALUES
('combo001', 'combo', 'Combo 2 Người', 99000, '2 cà phê bất kỳ + 1 đồ ăn nhẹ', '["Tiết kiệm 21K"]', 'Best Value', 1),
('combo002', 'combo', 'Combo Nhóm 4', 189000, '4 đồ uống bất kỳ + 2 đồ ăn nhẹ', '["Tiết kiệm 31K"]', 'Group Deal', 1),
('combo003', 'combo', 'Set Breakfast', 55000, '1 cà phê + 1 bánh mì/sandwich (7:00-9:00)', '["7:00-9:00"]', 'Morning', 1),
('combo004', 'combo', '+ Phần Ăn Thêm', 25000, 'Thêm phần ăn nhẹ bất kỳ vào combo', '["Add-on"]', NULL, 1);

-- =====================================================
-- CATEGORIES
-- =====================================================
DELETE FROM categories;
INSERT INTO categories (id, name, slug, description, sort_order) VALUES
('cat_coffee',    'Coffee',           'coffee',    'Cà phê truyền thống & specialty', 1),
('cat_signature', 'Signature Drinks', 'signature', 'Đồ uống đặc biệt AURA SPACE',   2),
('cat_snacks',    'Snacks',           'snacks',    'Đồ ăn nhẹ & bánh ngọt',          3),
('cat_combo',     'Combo',            'combo',     'Combo tiết kiệm',                4);

-- =====================================================
-- PRODUCTS (mirror of menu_items for KDS/POS routes)
-- =====================================================
DELETE FROM products;
INSERT INTO products (id, category_id, name, price, description, tags, badge, is_available) VALUES
('p001', 'cat_coffee',    'Espresso',              45000, 'Cà phê nguyên chất 100% Arabica',               '["Hot/Cold","30ml"]',   'Best Seller', 1),
('p002', 'cat_coffee',    'Cappuccino',            55000, 'Espresso + sữa nóng đánh bọt + foam dày',       '["Hot","180ml"]',       NULL, 1),
('p003', 'cat_coffee',    'Latte Art',             60000, 'Espresso + sữa tươi + nghệ thuật vẽ foam',      '["Hot/Cold","240ml"]',  'Popular', 1),
('p004', 'cat_coffee',    'Cà Phê Sữa Đá',        35000, 'Cà phê phin truyền thống + sữa đặc + đá',      '["Cold","200ml"]',      'Vietnamese Classic', 1),
('p005', 'cat_coffee',    'Cold Brew Tower (12h)', 55000, 'Cà phê ủ lạnh 12 giờ, vị mượt, ít axit',       '["Cold","300ml"]',      'Slow Brew', 1),
('p006', 'cat_signature', 'Container Special',     65000, 'Signature: Espresso + tonic + cam slice',        '["Cold","300ml"]',      'Signature', 1),
('p007', 'cat_signature', 'Dirty Matcha Latte',    55000, 'Matcha Nhật Bản + espresso double shot',         '["Hot/Cold","300ml"]',  NULL, 1),
('p008', 'cat_signature', 'Trà Sen Vàng',          45000, 'Trà sen + hạt sen + đường phèn',                '["Hot/Cold","350ml"]',  NULL, 1),
('p009', 'cat_snacks',    'Bánh Mì Chả Lụa',      35000, 'Bánh mì baguette + chả lụa + đồ chua',         '["Hot","1 ổ"]',         NULL, 1),
('p010', 'cat_snacks',    'Croissant Bơ Pháp',     45000, 'Croissant nướng bơ Pháp, giòn tan',             '["Hot","1 cái"]',       'French Style', 1),
('p011', 'cat_combo',     'Combo 2 Người',         99000, '2 cà phê bất kỳ + 1 đồ ăn nhẹ',               '["Tiết kiệm 21K"]',    'Best Value', 1),
('p012', 'cat_combo',     'Set Breakfast',          55000, '1 cà phê + 1 bánh mì/sandwich (7:00-9:00)',    '["7:00-9:00"]',         'Morning', 1);

-- =====================================================
-- CAFE TABLES (matching POS table map)
-- =====================================================
DELETE FROM cafe_tables;
INSERT INTO cafe_tables (id, table_number, capacity, zone, status) VALUES
('t01', '1',  2, 'Indoor',  'Available'),
('t02', '2',  2, 'Indoor',  'Available'),
('t03', '3',  4, 'Indoor',  'Available'),
('t04', '4',  4, 'Indoor',  'Available'),
('t05', '5',  2, 'Outdoor', 'Available'),
('t06', '6',  2, 'Outdoor', 'Available'),
('t07', '7',  4, 'Outdoor', 'Available'),
('t08', '8',  4, 'Outdoor', 'Available'),
('t09', '9',  6, 'Outdoor', 'Available'),
('t10', '10', 4, 'VIP',     'Available'),
('t11', '11', 6, 'VIP',     'Available'),
('t12', '12', 8, 'VIP',     'Available');

-- =====================================================
-- LOYALTY TIERS
-- =====================================================
DELETE FROM loyalty_tiers;
INSERT INTO loyalty_tiers (tier_name, min_points, cashback_rate, point_multiplier, birthday_discount, free_upsize_per_week, priority_booking_hours, benefits_json) VALUES
('silver',   0,    0.02, 1.0, 0.10, 0, 0,  '["Cashback 2%","Tích 1đ/10k","Sinh nhật -10%"]'),
('gold',     500,  0.05, 1.5, 0.15, 1, 24, '["Cashback 5%","Tích 1.5đ/10k","Sinh nhật -15%","Upsize miễn phí 1 lần/tuần","Ưu tiên đặt chỗ 24h"]'),
('platinum', 1000, 0.08, 2.0, 0.20, 2, 48, '["Cashback 8%","Tích 2đ/10k","Sinh nhật -20%","Upsize miễn phí 2 lần/tuần","Ưu tiên đặt chỗ 48h","Quà tặng hàng tháng"]');

-- =====================================================
-- REWARDS CATALOG
-- =====================================================
DELETE FROM rewards;
CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  point_cost INTEGER NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value REAL NOT NULL,
  min_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO rewards (id, title, description, point_cost, discount_type, discount_value, min_order) VALUES
('rwd_001', 'Giảm 10K',         'Voucher giảm 10,000₫ cho đơn từ 50K',      50,  'fixed',   10000, 50000),
('rwd_002', 'Giảm 25K',         'Voucher giảm 25,000₫ cho đơn từ 100K',     120, 'fixed',   25000, 100000),
('rwd_003', 'Giảm 10%',         'Voucher giảm 10% tối đa 30K',              80,  'percent', 10,    0),
('rwd_004', 'Upsize Miễn Phí',  'Nâng cỡ đồ uống bất kỳ miễn phí',          30,  'fixed',   0,     0),
('rwd_005', 'Thức Uống Tặng',   '1 đồ uống miễn phí (tối đa 65K) sinh nhật',200, 'fixed',   65000, 0);

-- Verify
SELECT COUNT(*) as total_items FROM menu_items;
-- Expected: 26 items

-- ==========================================
-- REVIEWS SEED DATA
-- ==========================================
INSERT INTO reviews (id, customer_name, rating, content, tags, status) VALUES
('r1', 'Nguyễn Văn A', 5, 'Không gian tuyệt vời, rất hợp để làm việc!', '["space", "quiet"]', 'published'),
('r2', 'Trần Thị B', 4, 'Cà phê rất đậm đà. Nhân viên nhiệt tình.', '["coffee", "service"]', 'published'),
('r3', 'Lê Hoàng C', 5, 'Signature Container Special uống vừa miệng, view container độc lạ!', '["drinks", "view"]', 'published'),
('r4', 'Phạm D', 3, 'Giá hơi chua nhưng quán mát mẻ, 10 điểm cho thiết kế.', '["price", "design"]', 'published'),
('r5', 'Hoàng E', 5, 'Kombucha ngon, uống xong thấy hệ tiêu hóa khỏe hẳn =))', '["drinks"]', 'published'),
('r6', 'Ngô F', 4, 'Quán hơi đông vào buổi tối, nên đi sớm có chỗ ngồi ngon.', '["space"]', 'published'),
('r7', 'Vũ G', 5, 'Bạc xỉu đá béo béo, rất hợp gu mình!', '["drinks"]', 'published'),
('r8', 'Đinh H', 5, 'Combo 2 Người quá hời, tiết kiệm hẳn, đồ ăn ngon.', '["food", "combo"]', 'published'),
('r9', 'Bùi K', 4, 'Bánh croissant giòn, nhưng ít bơ hơn mong đợi.', '["food"]', 'published'),
('r10', 'Lý L', 5, 'View ngắm cảng siêu mê, nhạc lofi chill.', '["space", "music"]', 'published');

-- ==========================================
-- LOYALTY TIERS SEED DATA
-- ==========================================
INSERT INTO loyalty_tiers (name, min_points, cashback_percent, benefits) VALUES
('silver', 0, 2.0, '["Tích lũy 2%", "Tặng nước ngày sinh nhật"]'),
('gold', 500, 5.0, '["Tích lũy 5%", "Bàn VIP ưu tiên"]'),
('platinum', 2000, 10.0, '["Tích lũy 10%", "Freesize up", "Bàn VIP", "Mời sự kiện exclusive"]');

-- ==========================================
-- LOYALTY REWARDS SEED DATA
-- ==========================================
INSERT INTO loyalty_rewards (name, points_cost, category, description) VALUES
('Voucher Giảm 10%', 100, 'voucher', 'Giảm 10% cho tổng bill tiếp theo'),
('Free Size Up', 150, 'voucher', 'Nâng cấp size miễn phí cho 1 ly nước'),
('Mua 1 Tặng 1', 300, 'voucher', 'Áp dụng cho mọi loại nước trong menu'),
('Free Topping', 50, 'voucher', 'Miễn phí topping bất kỳ (trân châu, thạch...)'),
('Voucher 50K', 500, 'voucher', 'Giảm trực tiếp 50K vào tổng bill');

SELECT COUNT(*) as total_products FROM products;
SELECT COUNT(*) as total_tables FROM cafe_tables;
SELECT COUNT(*) as total_tiers FROM loyalty_tiers;
SELECT COUNT(*) as total_rewards FROM rewards;
-- Expected: 26 items, 12 products, 12 tables, 3 tiers, 5 rewards
