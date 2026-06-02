-- F&B Caffe Container - Seed Data
-- EXACT data from physical VIVA menu (10 groups, 49 items)

-- Disable FK checks during seed to allow any order
PRAGMA foreign_keys = OFF;

-- Clear all data (children first to avoid FK issues)
DELETE FROM products;
DELETE FROM menu_items;
DELETE FROM categories;

-- ☕ Cà phê truyền thống (7)
INSERT INTO menu_items (id, category, name, price, description, tags, badge, available) VALUES
('tc001', 'traditional-coffee', 'Cà phê máy/ phin (Iced/Hot Coffee)', 20000, 'Cà phê máy hoặc phin truyền thống', '["Iced/Hot"]', NULL, 1),
('tc002', 'traditional-coffee', 'Cà phê sữa máy/ phin (Iced/Hot Milk Coffee)', 25000, 'Cà phê sữa máy hoặc phin', '["Iced/Hot"]', 'Best Seller', 1),
('tc003', 'traditional-coffee', 'Cà phê/ Matcha muối (Salted Coffee)', 28000, 'Cà phê hoặc Matcha muối', '["Iced/Hot"]', NULL, 1),
('tc004', 'traditional-coffee', 'Bạc xỉu đá/ nóng (Iced/Hot White Coffee)', 28000, 'Bạc xỉu đá hoặc nóng', '["Iced/Hot"]', NULL, 1),
('tc005', 'traditional-coffee', 'Ca cao đá/ nóng', 20000, 'Ca cao đá hoặc nóng', '["Iced/Hot"]', NULL, 1),
('tc006', 'traditional-coffee', 'Ca cao sữa đá/ nóng', 30000, 'Ca cao sữa đá hoặc nóng', '["Iced/Hot"]', NULL, 1),
('tc007', 'traditional-coffee', 'Matcha latte đá', 25000, 'Matcha latte đá', '["Iced"]', NULL, 1);

-- 🔥 Cà phê nóng (6)
INSERT INTO menu_items (id, category, name, price, description, tags, badge, available) VALUES
('hc001', 'hot-coffee', 'Cà phê kiểu Ý (Espresso)', 20000, 'Espresso kiểu Ý', '["Hot"]', NULL, 1),
('hc002', 'hot-coffee', 'Cà phê kiểu Mỹ (Americano)', 25000, 'Americano kiểu Mỹ', '["Hot"]', NULL, 1),
('hc003', 'hot-coffee', 'Cà phê bọt sữa (Cappuccino)', 35000, 'Cappuccino bọt sữa', '["Hot"]', NULL, 1),
('hc004', 'hot-coffee', 'Cà phê và Socola (Mocha)', 35000, 'Mocha cà phê socola', '["Hot"]', NULL, 1),
('hc005', 'hot-coffee', 'Cà phê sữa nóng kiểu Ý (Latte)', 35000, 'Latte sữa nóng kiểu Ý', '["Hot"]', NULL, 1),
('hc006', 'hot-coffee', 'Trà xanh sữa nóng (Greentea Latte)', 35000, 'Greentea Latte', '["Hot"]', NULL, 1);

-- 🧊 Đá xay / Frappuccino (6)
INSERT INTO menu_items (id, category, name, price, description, tags, badge, available) VALUES
('fp001', 'frappuccino', 'Cà phê đá xay (Coffee Frappu)', 35000, 'Cà phê đá xay', '["Blended"]', NULL, 1),
('fp002', 'frappuccino', 'Cà phê bánh xay (Cookie Frappu)', 35000, 'Cookie Frappu', '["Blended"]', NULL, 1),
('fp003', 'frappuccino', 'Cà phê Socola đá xay (Mocha Frappu)', 35000, 'Mocha Frappu', '["Blended"]', NULL, 1),
('fp004', 'frappuccino', 'Cà phê Dừa Việt quốc (Coconut Blueberry Coffee Ice)', 35000, 'Coconut Blueberry Coffee', '["Blended"]', NULL, 1),
('fp005', 'frappuccino', 'Sữa chua Việt quốc bánh xay (Blueberry Yogurt Frappu)', 35000, 'Blueberry Yogurt Frappu', '["Blended"]', NULL, 1),
('fp006', 'frappuccino', 'Trà xanh đá xay (Matcha)', 35000, 'Matcha đá xay', '["Blended"]', NULL, 1);

-- 🥤 Sinh tố / Smoothies (4)
INSERT INTO menu_items (id, category, name, price, description, tags, badge, available) VALUES
('sm001', 'smoothies', 'Sinh tố Dâu (Strawberry)', 35000, 'Sinh tố dâu tươi', '["Blended"]', NULL, 1),
('sm002', 'smoothies', 'Sinh tố Bơ (Avocado)', 35000, 'Sinh tố bơ', '["Blended"]', NULL, 1),
('sm003', 'smoothies', 'Sinh tố Mãng cầu (Soursop)', 35000, 'Sinh tố mãng cầu', '["Blended"]', NULL, 1),
('sm004', 'smoothies', 'Sinh tố Sapo (Sapodilla)', 35000, 'Sinh tố sapo', '["Blended"]', NULL, 1);

-- 🫧 Soda kiểu Ý (2)
INSERT INTO menu_items (id, category, name, price, description, tags, badge, available) VALUES
('sd001', 'soda', 'Sapphire (Blue Curacao)', 25000, 'Soda Blue Curacao', '["Iced"]', NULL, 1),
('sd002', 'soda', 'Emerald (Bạc Hà)', 25000, 'Soda bạc hà', '["Iced"]', NULL, 1);

-- 🍵 Trà / Tea (6)
INSERT INTO menu_items (id, category, name, price, description, tags, badge, available) VALUES
('te001', 'tea', 'Lipton chanh đá/nóng', 18000, 'Lipton chanh', '["Iced/Hot"]', NULL, 1),
('te002', 'tea', 'Lipton sữa đá/ nóng', 25000, 'Lipton sữa', '["Iced/Hot"]', NULL, 1),
('te003', 'tea', 'Lipton cam đá/ nóng', 25000, 'Lipton cam', '["Iced/Hot"]', NULL, 1),
('te004', 'tea', 'Trà cúc thảo mộc đá/ nóng', 29000, 'Trà cúc thảo mộc', '["Iced/Hot"]', NULL, 1),
('te005', 'tea', 'Trà mãng cầu', 29000, 'Trà mãng cầu', '["Iced/Hot"]', NULL, 1),
('te006', 'tea', 'Trà đào', 30000, 'Trà đào', '["Iced/Hot"]', 'Popular', 1);

-- 🥤 Thức uống khác (5)
INSERT INTO menu_items (id, category, name, price, description, tags, badge, available) VALUES
('od001', 'other-drinks', 'Trà đường', 18000, 'Trà đường', '["Iced"]', NULL, 1),
('od002', 'other-drinks', 'Bình trà bắc', 15000, 'Bình trà bắc', '["Hot"]', NULL, 1),
('od003', 'other-drinks', 'Đá me', 18000, 'Đá me', '["Iced"]', NULL, 1),
('od004', 'other-drinks', 'Chanh muối', 18000, 'Chanh muối', '["Iced"]', NULL, 1),
('od005', 'other-drinks', 'Sữa tươi', 20000, 'Sữa tươi', '["Cold"]', NULL, 1);

-- 🥛 Yaourt (4)
INSERT INTO menu_items (id, category, name, price, description, tags, badge, available) VALUES
('yg001', 'yogurt', 'Yaourt đá', 20000, 'Yaourt đá', '["Iced"]', NULL, 1),
('yg002', 'yogurt', 'Yaourt cà phê', 23000, 'Yaourt cà phê', '["Iced"]', NULL, 1),
('yg003', 'yogurt', 'Yaourt Việt Quốc', 25000, 'Yaourt Việt Quốc', '["Iced"]', NULL, 1),
('yg004', 'yogurt', 'Yaourt hủ', 15000, 'Yaourt hủ', '["Original"]', NULL, 1);

-- 🍊 Nước ép (6)
INSERT INTO menu_items (id, category, name, price, description, tags, badge, available) VALUES
('jc001', 'juice', 'Đá chanh', 18000, 'Đá chanh', '["Iced"]', NULL, 1),
('jc002', 'juice', 'Rau má', 18000, 'Rau má', '["Iced"]', NULL, 1),
('jc003', 'juice', 'Rau má dừa/sữa', 25000, 'Rau má dừa hoặc sữa', '["Iced"]', NULL, 1),
('jc004', 'juice', 'Dừa trái', 23000, 'Dừa trái', '["Iced"]', NULL, 1),
('jc005', 'juice', 'Dừa đá', 25000, 'Dừa đá', '["Iced"]', NULL, 1),
('jc006', 'juice', 'Cam vắt', 23000, 'Cam vắt tươi', '["Fresh"]', NULL, 1);

-- 🧴 Giải khát đóng chai (3)
INSERT INTO menu_items (id, category, name, price, description, tags, badge, available) VALUES
('bt001', 'bottled', 'Nước suối', 10000, 'Nước suối đóng chai', '["Cold"]', NULL, 1),
('bt002', 'bottled', 'Sting/ Coca/ Pepsi/ 7 UP/ Ô long', 15000, 'Nước ngọt đóng chai', '["Cold"]', NULL, 1),
('bt003', 'bottled', 'Redbull', 20000, 'Redbull', '["Cold"]', NULL, 1);

-- =====================================================
-- CATEGORIES (10 groups matching physical menu)
-- =====================================================
INSERT INTO categories (id, name, slug, description, sort_order) VALUES
('cat_trad_coffee', 'Cà Phê Truyền Thống', 'traditional-coffee', 'Cà phê phin & máy truyền thống', 1),
('cat_hot_coffee',  'Cà Phê Nóng',         'hot-coffee',         'Cà phê kiểu Ý & Mỹ nóng',       2),
('cat_frappuccino', 'Đá Xay (Frappuccino)', 'frappuccino',        'Đá xay mát lạnh',                3),
('cat_smoothies',   'Sinh Tố (Smoothies)',  'smoothies',          'Sinh tố trái cây tươi',          4),
('cat_soda',        'Soda Kiểu Ý',         'soda',               'Soda tươi pha chế',              5),
('cat_tea',         'Trà (Tea)',            'tea',                'Trà & thảo mộc',                 6),
('cat_other',       'Thức Uống Khác',      'other-drinks',       'Trà, sữa, giải khát',            7),
('cat_yogurt',      'Yaourt',              'yogurt',             'Yaourt các loại',                 8),
('cat_juice',       'Nước Ép',             'juice',              'Nước ép tươi',                    9),
('cat_bottled',     'Giải Khát Đóng Chai', 'bottled',            'Nước đóng chai',                 10);

-- =====================================================
-- PRODUCTS (mirror of menu_items for KDS/POS routes)
-- =====================================================
INSERT INTO products (id, category_id, name, price, description, tags, badge, is_available) VALUES
('tc001', 'cat_trad_coffee', 'Cà phê máy/ phin (Iced/Hot Coffee)', 20000, 'Cà phê máy hoặc phin', '["Iced/Hot"]', NULL, 1),
('tc002', 'cat_trad_coffee', 'Cà phê sữa máy/ phin (Iced/Hot Milk Coffee)', 25000, 'Cà phê sữa', '["Iced/Hot"]', 'Best Seller', 1),
('tc003', 'cat_trad_coffee', 'Cà phê/ Matcha muối (Salted Coffee)', 28000, 'Cà phê hoặc Matcha muối', '["Iced/Hot"]', NULL, 1),
('tc004', 'cat_trad_coffee', 'Bạc xỉu đá/ nóng', 28000, 'Bạc xỉu', '["Iced/Hot"]', NULL, 1),
('tc005', 'cat_trad_coffee', 'Ca cao đá/ nóng', 20000, 'Ca cao', '["Iced/Hot"]', NULL, 1),
('tc006', 'cat_trad_coffee', 'Ca cao sữa đá/ nóng', 30000, 'Ca cao sữa', '["Iced/Hot"]', NULL, 1),
('tc007', 'cat_trad_coffee', 'Matcha latte đá', 25000, 'Matcha latte', '["Iced"]', NULL, 1),
('hc001', 'cat_hot_coffee', 'Cà phê kiểu Ý (Espresso)', 20000, 'Espresso', '["Hot"]', NULL, 1),
('hc002', 'cat_hot_coffee', 'Cà phê kiểu Mỹ (Americano)', 25000, 'Americano', '["Hot"]', NULL, 1),
('hc003', 'cat_hot_coffee', 'Cà phê bọt sữa (Cappuccino)', 35000, 'Cappuccino', '["Hot"]', NULL, 1),
('hc004', 'cat_hot_coffee', 'Cà phê và Socola (Mocha)', 35000, 'Mocha', '["Hot"]', NULL, 1),
('hc005', 'cat_hot_coffee', 'Cà phê sữa nóng kiểu Ý (Latte)', 35000, 'Latte', '["Hot"]', NULL, 1),
('hc006', 'cat_hot_coffee', 'Trà xanh sữa nóng (Greentea Latte)', 35000, 'Greentea Latte', '["Hot"]', NULL, 1),
('fp001', 'cat_frappuccino', 'Cà phê đá xay (Coffee Frappu)', 35000, 'Coffee Frappu', '["Blended"]', NULL, 1),
('fp002', 'cat_frappuccino', 'Cà phê bánh xay (Cookie Frappu)', 35000, 'Cookie Frappu', '["Blended"]', NULL, 1),
('fp003', 'cat_frappuccino', 'Cà phê Socola đá xay (Mocha Frappu)', 35000, 'Mocha Frappu', '["Blended"]', NULL, 1),
('fp004', 'cat_frappuccino', 'Cà phê Dừa Việt quốc (Coconut Blueberry)', 35000, 'Coconut Blueberry', '["Blended"]', NULL, 1),
('fp005', 'cat_frappuccino', 'Sữa chua Việt quốc bánh xay (Blueberry Yogurt)', 35000, 'Blueberry Yogurt', '["Blended"]', NULL, 1),
('fp006', 'cat_frappuccino', 'Trà xanh đá xay (Matcha)', 35000, 'Matcha đá xay', '["Blended"]', NULL, 1),
('sm001', 'cat_smoothies', 'Sinh tố Dâu (Strawberry)', 35000, 'Sinh tố dâu', '["Blended"]', NULL, 1),
('sm002', 'cat_smoothies', 'Sinh tố Bơ (Avocado)', 35000, 'Sinh tố bơ', '["Blended"]', NULL, 1),
('sm003', 'cat_smoothies', 'Sinh tố Mãng cầu (Soursop)', 35000, 'Sinh tố mãng cầu', '["Blended"]', NULL, 1),
('sm004', 'cat_smoothies', 'Sinh tố Sapo (Sapodilla)', 35000, 'Sinh tố sapo', '["Blended"]', NULL, 1),
('sd001', 'cat_soda', 'Sapphire (Blue Curacao)', 25000, 'Soda Blue Curacao', '["Iced"]', NULL, 1),
('sd002', 'cat_soda', 'Emerald (Bạc Hà)', 25000, 'Soda bạc hà', '["Iced"]', NULL, 1),
('te001', 'cat_tea', 'Lipton chanh đá/nóng', 18000, 'Lipton chanh', '["Iced/Hot"]', NULL, 1),
('te002', 'cat_tea', 'Lipton sữa đá/ nóng', 25000, 'Lipton sữa', '["Iced/Hot"]', NULL, 1),
('te003', 'cat_tea', 'Lipton cam đá/ nóng', 25000, 'Lipton cam', '["Iced/Hot"]', NULL, 1),
('te004', 'cat_tea', 'Trà cúc thảo mộc đá/ nóng', 29000, 'Trà cúc thảo mộc', '["Iced/Hot"]', NULL, 1),
('te005', 'cat_tea', 'Trà mãng cầu', 29000, 'Trà mãng cầu', '["Iced/Hot"]', NULL, 1),
('te006', 'cat_tea', 'Trà đào', 30000, 'Trà đào', '["Iced/Hot"]', 'Popular', 1),
('od001', 'cat_other', 'Trà đường', 18000, 'Trà đường', '["Iced"]', NULL, 1),
('od002', 'cat_other', 'Bình trà bắc', 15000, 'Bình trà bắc', '["Hot"]', NULL, 1),
('od003', 'cat_other', 'Đá me', 18000, 'Đá me', '["Iced"]', NULL, 1),
('od004', 'cat_other', 'Chanh muối', 18000, 'Chanh muối', '["Iced"]', NULL, 1),
('od005', 'cat_other', 'Sữa tươi', 20000, 'Sữa tươi', '["Cold"]', NULL, 1),
('yg001', 'cat_yogurt', 'Yaourt đá', 20000, 'Yaourt đá', '["Iced"]', NULL, 1),
('yg002', 'cat_yogurt', 'Yaourt cà phê', 23000, 'Yaourt cà phê', '["Iced"]', NULL, 1),
('yg003', 'cat_yogurt', 'Yaourt Việt Quốc', 25000, 'Yaourt Việt Quốc', '["Iced"]', NULL, 1),
('yg004', 'cat_yogurt', 'Yaourt hủ', 15000, 'Yaourt hủ', '["Original"]', NULL, 1),
('jc001', 'cat_juice', 'Đá chanh', 18000, 'Đá chanh', '["Iced"]', NULL, 1),
('jc002', 'cat_juice', 'Rau má', 18000, 'Rau má', '["Iced"]', NULL, 1),
('jc003', 'cat_juice', 'Rau má dừa/sữa', 25000, 'Rau má dừa/sữa', '["Iced"]', NULL, 1),
('jc004', 'cat_juice', 'Dừa trái', 23000, 'Dừa trái', '["Iced"]', NULL, 1),
('jc005', 'cat_juice', 'Dừa đá', 25000, 'Dừa đá', '["Iced"]', NULL, 1),
('jc006', 'cat_juice', 'Cam vắt', 23000, 'Cam vắt', '["Fresh"]', NULL, 1),
('bt001', 'cat_bottled', 'Nước suối', 10000, 'Nước suối', '["Cold"]', NULL, 1),
('bt002', 'cat_bottled', 'Sting/ Coca/ Pepsi/ 7 UP/ Ô long', 15000, 'Nước ngọt đóng chai', '["Cold"]', NULL, 1),
('bt003', 'cat_bottled', 'Redbull', 20000, 'Redbull', '["Cold"]', NULL, 1);

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
INSERT INTO loyalty_tiers (tier_name, display_name_vi, min_points, min_spent_vnd, max_spent_vnd, cashback_rate, point_multiplier, birthday_discount, expiry_days, sort_order) VALUES
('bronze',   'Đồng',     0,   0,        500000,   0.03, 1.0, 5,  90,   1),
('silver',   'Bạc',      50,  500000,   5000000,  0.05, 1.1, 10, 120,  2),
('gold',     'Vàng',     200, 5000000,  15000000, 0.07, 1.3, 15, 180,  3),
('platinum', 'Bạch Kim', 500, 15000000, NULL,     0.10, 1.5, 20, NULL, 4);

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
('rwd_005', 'Thức Uống Tặng',   '1 đồ uống miễn phí (tối đa 35K) sinh nhật',200, 'fixed',   35000, 0);

-- ==========================================
-- REVIEWS SEED DATA
-- ==========================================
INSERT INTO reviews (id, customer_name, rating, content, tags, status) VALUES
('r1', 'Nguyễn Văn A', 5, 'Không gian tuyệt vời, rất hợp để làm việc!', '["space", "quiet"]', 'published'),
('r2', 'Trần Thị B', 4, 'Cà phê rất đậm đà. Nhân viên nhiệt tình.', '["coffee", "service"]', 'published'),
('r3', 'Lê Hoàng C', 5, 'Bạc xỉu ngon lắm, view container độc lạ!', '["drinks", "view"]', 'published'),
('r4', 'Phạm D', 3, 'Giá hơi cao nhưng quán mát mẻ, 10 điểm cho thiết kế.', '["price", "design"]', 'published'),
('r5', 'Hoàng E', 5, 'Trà đào rất ngon, không gian thoáng mát!', '["drinks"]', 'published'),
('r6', 'Ngô F', 4, 'Quán hơi đông vào buổi tối, nên đi sớm có chỗ ngồi ngon.', '["space"]', 'published'),
('r7', 'Vũ G', 5, 'Bạc xỉu đá béo béo, rất hợp gu mình!', '["drinks"]', 'published'),
('r8', 'Đinh H', 5, 'Sinh tố bơ ngon xuất sắc, giá phải chăng.', '["drinks"]', 'published'),
('r9', 'Bùi K', 4, 'Soda Sapphire rất đẹp mắt và ngon.', '["drinks"]', 'published'),
('r10', 'Lý L', 5, 'View ngắm cảng siêu mê, nhạc lofi chill.', '["space", "music"]', 'published');

-- ==========================================
-- PROMOTIONS SEED DATA
-- ==========================================
DELETE FROM promotions;
INSERT INTO promotions (code, percent, max_discount, min_order, usage_limit, usage_count, starts_at, expires_at, is_active) VALUES
('AURA20',  20, 50000, 0, 0, 0, '2026-06-06T00:00:00Z', '2026-06-06T23:59:59Z', 1),
('AURA10',  10, 30000, 0, 0, 0, '2026-06-07T00:00:00Z', '2026-06-13T23:59:59Z', 1),
('WELCOME', 10, 30000, 0, 0, 0, NULL,                  NULL,                  1);

-- ==========================================
-- LOYALTY REWARDS SEED DATA
-- ==========================================
INSERT INTO loyalty_rewards (name, points_cost, category, description) VALUES
('Voucher Giảm 10%', 100, 'voucher', 'Giảm 10% cho tổng bill tiếp theo'),
('Free Size Up', 150, 'voucher', 'Nâng cấp size miễn phí cho 1 ly nước'),
('Mua 1 Tặng 1', 300, 'voucher', 'Áp dụng cho mọi loại nước trong menu'),
('Free Topping', 50, 'voucher', 'Miễn phí topping bất kỳ (trân châu, thạch...)'),
('Voucher 50K', 500, 'voucher', 'Giảm trực tiếp 50K vào tổng bill');

-- Verify
SELECT COUNT(*) as total_menu_items FROM menu_items;
-- Expected: 49 items
SELECT COUNT(*) as total_products FROM products;
-- Expected: 49 products
SELECT COUNT(*) as total_categories FROM categories;
-- Expected: 10 categories
SELECT COUNT(*) as total_tables FROM cafe_tables;
-- Expected: 12 tables
