-- =============================================================================
-- Migration: 20261030_02_replica_schema_parity_and_waste_log_cutover.sql
-- Purpose: Converge incremental production D1 replica migrations to 100% 124-table
--          and column parity with worker/schema.sql and db/schema.sql.
-- =============================================================================

CREATE TABLE IF NOT EXISTS waste_log (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  reason TEXT NOT NULL,
  recorded_by TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_waste_log_item ON waste_log(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_waste_log_date ON waste_log(created_at);

-- 1. cafe_tables & menu_items
ALTER TABLE cafe_tables ADD COLUMN created_at TEXT;
ALTER TABLE menu_items ADD COLUMN is_local_specialty INTEGER DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN ingredient_source TEXT;

-- 2. customers & reviews
ALTER TABLE customers ADD COLUMN notes TEXT;
ALTER TABLE customers ADD COLUMN capture_source TEXT;
ALTER TABLE customers ADD COLUMN marketing_consent INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN consent_marketing INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN consent_analytics INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN consent_timestamp TEXT;
ALTER TABLE customers ADD COLUMN first_visit_at TEXT;
ALTER TABLE customers ADD COLUMN last_visit_at TEXT;
ALTER TABLE customers ADD COLUMN referred_by TEXT;

ALTER TABLE reviews ADD COLUMN customer_id TEXT;
ALTER TABLE reviews ADD COLUMN is_approved INTEGER DEFAULT 1;
ALTER TABLE reviews ADD COLUMN is_visible INTEGER DEFAULT 1;
ALTER TABLE reviews ADD COLUMN updated_at TEXT;

-- 3. cashback, rewards, promotions & referrals
ALTER TABLE cashback_wallets ADD COLUMN lifetime_earned INTEGER DEFAULT 0;
ALTER TABLE cashback_wallets ADD COLUMN lifetime_spent INTEGER DEFAULT 0;
ALTER TABLE cashback_wallets ADD COLUMN tier TEXT DEFAULT 'Member';

ALTER TABLE cashback_transactions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE rewards ADD COLUMN min_order INTEGER DEFAULT 0;
ALTER TABLE promotion_usages ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

ALTER TABLE referral_codes ADD COLUMN max_uses INTEGER DEFAULT 50;
ALTER TABLE referral_codes ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

ALTER TABLE referrals ADD COLUMN referee_id TEXT;
ALTER TABLE referrals ADD COLUMN referrer_reward INTEGER DEFAULT 10000;
ALTER TABLE referrals ADD COLUMN referee_reward INTEGER DEFAULT 5000;
ALTER TABLE referrals ADD COLUMN rewarded_at TEXT;

-- 4. staff_shifts, notification_audit_log, users & staff_login_identities
ALTER TABLE staff_shifts ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE staff_shifts ADD COLUMN staff_email TEXT;
ALTER TABLE staff_shifts ADD COLUMN shift_type TEXT;

ALTER TABLE notification_audit_log ADD COLUMN latency_ms INTEGER DEFAULT 0;

ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN full_name TEXT;
ALTER TABLE users ADD COLUMN password_changed_at TEXT;
ALTER TABLE users ADD COLUMN tier TEXT DEFAULT 'Member';
ALTER TABLE users ADD COLUMN total_points INTEGER DEFAULT 0;

ALTER TABLE staff_login_identities ADD COLUMN created_at TEXT;
ALTER TABLE staff_login_identities ADD COLUMN updated_at TEXT;

-- 5. loyalty_accounts, tier_configs & loyalty_redemptions
ALTER TABLE loyalty_accounts ADD COLUMN points_balance INTEGER DEFAULT 0;
ALTER TABLE loyalty_accounts ADD COLUMN tier_expires_at TEXT;
ALTER TABLE loyalty_accounts ADD COLUMN streak_days INTEGER DEFAULT 0;
ALTER TABLE loyalty_accounts ADD COLUMN last_checkin_date TEXT;
ALTER TABLE loyalty_accounts ADD COLUMN total_orders INTEGER DEFAULT 0;
ALTER TABLE loyalty_accounts ADD COLUMN referral_code TEXT;
ALTER TABLE loyalty_accounts ADD COLUMN referred_by TEXT;

ALTER TABLE tier_configs ADD COLUMN multiplier REAL NOT NULL DEFAULT 1.0;
ALTER TABLE tier_configs ADD COLUMN birthday_discount INTEGER DEFAULT 0;
ALTER TABLE tier_configs ADD COLUMN benefits TEXT DEFAULT '[]';
ALTER TABLE tier_configs ADD COLUMN display_name_vi TEXT;
ALTER TABLE tier_configs ADD COLUMN min_spent_vnd INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tier_configs ADD COLUMN max_spent_vnd INTEGER;

ALTER TABLE loyalty_redemptions ADD COLUMN voucher_code TEXT;
ALTER TABLE loyalty_redemptions ADD COLUMN used_at TEXT;

-- 6. recipe_ingredients & payment_transactions
ALTER TABLE recipe_ingredients ADD COLUMN waste_percentage REAL DEFAULT 0;
ALTER TABLE recipe_ingredients ADD COLUMN notes TEXT;

ALTER TABLE payment_transactions ADD COLUMN currency TEXT DEFAULT 'VND';
ALTER TABLE payment_transactions ADD COLUMN transaction_ref TEXT;
ALTER TABLE payment_transactions ADD COLUMN gateway_response TEXT;

ALTER TABLE ha_device_states ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE happy_hour_windows ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

-- 6b. kds_stations table & 8 inventory/purchasing parity columns
CREATE TABLE IF NOT EXISTS kds_stations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  categories TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO kds_stations (id, name, categories, is_active) VALUES
  ('bar',    'Quầy Bar & Pha Chế', '["coffee","tea","freeze","juice","traditional-coffee","hot-coffee","italian-soda","other-drinks","yogurt"]', 1),
  ('hot',    'Bếp Nóng',           '["food","hot","combo"]', 1),
  ('cold',   'Bếp Lạnh',           '["cold","salad","dessert"]', 1),
  ('bakery', 'Quầy Bánh',          '["pastry","bakery","cake","snacks"]', 1);

ALTER TABLE inventory_items ADD COLUMN reorder_point REAL DEFAULT 10;
ALTER TABLE inventory_items ADD COLUMN location TEXT DEFAULT 'main';
ALTER TABLE inventory_items ADD COLUMN expiry_date TEXT;
ALTER TABLE inventory_items ADD COLUMN supplier_id TEXT;

ALTER TABLE ingredients ADD COLUMN supplier_id TEXT;
ALTER TABLE ingredients ADD COLUMN last_restocked_at TEXT;

ALTER TABLE suppliers ADD COLUMN notes TEXT;

ALTER TABLE purchase_order_items ADD COLUMN unit TEXT NOT NULL DEFAULT 'g';

-- 6c. Canonical Container Lease Subscription Plans & SaaS Pricing Tiers
INSERT OR IGNORE INTO subscription_plans (
  id, name, slug, description, container_size,
  monthly_price_vnd, deposit_vnd, features,
  max_occupants, is_popular, is_active, sort_order
) VALUES
  (
    'plan_container_10ft',
    'Container 10ft Kiosk',
    'container-10ft',
    'Kiosk cà phê tinh gọn cho điểm bán mang đi và mặt bằng nhỏ.',
    '10ft',
    8000000,
    16000000,
    '["Diện tích 7.5m² tối ưu mang đi","Quầy bar inox + hệ thống điện nước","POS & QR Order tích hợp sẵn","Bảo trì định kỳ miễn phí"]',
    2,
    0,
    1,
    1
  ),
  (
    'plan_container_20ft',
    'Container 20ft Tiêu Chuẩn',
    'container-20ft',
    'Mô hình chuẩn AURA SPACE với quầy pha chế hoàn chỉnh và khu ngồi khách.',
    '20ft',
    12000000,
    24000000,
    '["Diện tích 15m² (1-2 nhân sự + chỗ ngồi)","Trang bị điều hòa, cách nhiệt PU, quầy pha chế","Full bộ POS, KDS, Loyalty & QR tại bàn","Hỗ trợ setup menu & công thức BOM chuẩn"]',
    4,
    1,
    1,
    2
  ),
  (
    'plan_container_40ft',
    'Container 40ft Flagship',
    'container-40ft',
    'Không gian Flagship kết hợp cà phê đặc sản, bánh ngọt và khu sự kiện.',
    '40ft',
    20000000,
    40000000,
    '["Diện tích 30m² + sân thượng/deck mở rộng","2 trạm pha chế + bếp bánh + khu khách VIP","Tích hợp Smart IoT, WiFi Marketing & ERPNext","Quản lý đa chi nhánh & hỗ trợ vận hành 24/7"]',
    8,
    0,
    1,
    3
  );

INSERT OR IGNORE INTO saas_pricing (
  id, slug, name_vi, name_en, description_vi, description_en,
  price_vnd, price_usd, currency, billing_period, sort_order, is_recommended,
  features_vi, features_en, cta_text_vi, cta_text_en, cta_link, active
) VALUES
  (
    'saas_starter',
    'starter',
    'Gói Khởi Đầu (10ft Kiosk)',
    'Starter (10ft Kiosk)',
    'Dành cho quầy cà phê mang đi hoặc 1 điểm bán đơn lẻ.',
    'Built for compact takeaway kiosks and single-location coffee bars.',
    990000,
    39,
    'VND',
    'monthly',
    1,
    0,
    '["POS & QR Order tại bàn không giới hạn","Quản lý thực đơn, modifier & định lượng BOM","Báo cáo doanh thu ca làm việc theo thời gian thực","Tích hợp thanh toán VietQR / PayOS tự động"]',
    '["Unlimited POS & table QR ordering","Menu, modifier & BOM recipe management","Real-time shift & daily revenue analytics","Automated VietQR / PayOS payment reconciliation"]',
    'Dùng thử 14 ngày',
    'Start 14-day trial',
    '/saas/onboard?tier=starter',
    1
  ),
  (
    'saas_growth',
    'growth',
    'Gói Tăng Trưởng (20ft Standard)',
    'Growth (20ft Standard)',
    'Giải pháp toàn diện cho quán Container tiêu chuẩn với KDS, Loyalty & dự báo tồn kho AI.',
    'Complete operating system for standard Container cafes with KDS, Loyalty & AI inventory forecasting.',
    1990000,
    79,
    'VND',
    'monthly',
    2,
    1,
    '["Toàn bộ tính năng gói Khởi Đầu","Màn hình bếp/bar KDS đa trạm & cảnh báo SLA","CRM, tích điểm Loyalty, hạng thành viên & giới thiệu bạn bè","Dự báo tồn kho AI & tự động đề xuất đơn nhập hàng (PO)"]',
    '["Everything in Starter","Multi-station KDS with SLA timers & audio alerts","CRM, Loyalty tiers, cashback wallet & referral engine","AI inventory run-rate forecasting & automated PO suggestions"]',
    'Chọn gói Tăng Trưởng',
    'Choose Growth',
    '/saas/onboard?tier=growth',
    1
  ),
  (
    'saas_enterprise',
    'enterprise',
    'Gói Chuỗi & Nhượng Quyền (40ft Flagship)',
    'Enterprise & Franchise (40ft Flagship)',
    'Quản trị chuỗi đa chi nhánh, đồng bộ ERPNext, nhượng quyền và SLA 99.9%.',
    'Multi-store franchise HQ, ERPNext two-way sync, custom branding, and 99.9% SLA.',
    4990000,
    199,
    'VND',
    'monthly',
    3,
    0,
    '["Quản lý đa chi nhánh (Multi-tenant HQ) & phí bản quyền nhượng quyền","Đồng bộ 2 chiều ERPNext (Kế toán, Kho tổng, Mua hàng)","WiFi Captive Portal & tự động hóa chiến dịch Mautic/Zalo ZNS","Hỗ trợ kỹ thuật 24/7 & triển khai riêng theo yêu cầu"]',
    '["Multi-tenant Franchise HQ & automated royalty ledger","Two-way ERPNext sync (Accounting, Central Warehouse, Purchasing)","WiFi Captive Portal & Mautic/Zalo ZNS campaign automation","24/7 priority engineering support & custom onboarding"]',
    'Liên hệ tư vấn',
    'Contact Sales',
    '/saas/onboard?tier=enterprise',
    1
  );

-- 7. Backfill newly added parity columns on loyalty_accounts & tier_configs
UPDATE loyalty_accounts
SET points_balance = COALESCE(current_points, 0),
    referral_code = COALESCE(
      referral_code,
      (SELECT c.referral_code FROM customers c WHERE c.id = loyalty_accounts.customer_id)
    ),
    referred_by = COALESCE(
      referred_by,
      (SELECT c.referred_by FROM customers c WHERE c.id = loyalty_accounts.customer_id)
    );

UPDATE tier_configs
SET multiplier = COALESCE(points_multiplier, 1.0),
    benefits = COALESCE(perks, '[]'),
    display_name_vi = COALESCE(display_name_vi, tier_name);

-- 8. Reconcile seed rows across paired loyalty_rewards/rewards and loyalty_tier_configs/tier_configs
INSERT OR IGNORE INTO loyalty_rewards (
  id, name, description, points_cost, points_required,
  type, reward_type, value, reward_value,
  min_tier, max_redemptions, stock, image_url, is_active, created_at, updated_at
)
SELECT
  id,
  COALESCE(name, title),
  description,
  COALESCE(points_cost, point_cost, 100),
  COALESCE(points_cost, point_cost, 100),
  CASE
    WHEN COALESCE(type, discount_type) IN ('percent', 'discount_percent') THEN 'discount_percent'
    WHEN COALESCE(type, discount_type) IN ('fixed', 'discount_fixed') THEN 'discount_fixed'
    ELSE COALESCE(type, discount_type, 'voucher')
  END,
  CASE
    WHEN COALESCE(reward_type, type, discount_type) IN ('percent', 'discount_percent') THEN 'discount_percent'
    WHEN COALESCE(reward_type, type, discount_type) IN ('fixed', 'discount_fixed') THEN 'discount_fixed'
    ELSE COALESCE(reward_type, type, discount_type, 'voucher')
  END,
  COALESCE(value, discount_value, 0),
  CAST(COALESCE(reward_value, value, discount_value, 0) AS TEXT),
  COALESCE(min_tier, 'bronze'),
  CASE WHEN stock IS NOT NULL AND stock > 0 THEN stock ELSE NULL END,
  stock,
  image_url,
  COALESCE(is_active, 1),
  COALESCE(created_at, datetime('now')),
  COALESCE(updated_at, created_at, datetime('now'))
FROM rewards;

INSERT OR IGNORE INTO loyalty_tier_configs (
  tier, name, min_points, point_multiplier, points_multiplier,
  discount_percent, birthday_bonus, benefits, color, updated_at
)
SELECT
  tier,
  COALESCE(display_name_vi, tier_name, tier),
  COALESCE(min_points, 0),
  COALESCE(point_multiplier, points_multiplier, multiplier, 1.0),
  COALESCE(points_multiplier, point_multiplier, multiplier, 1.0),
  ROUND(COALESCE(cashback_rate, 0) * 100, 1),
  COALESCE(birthday_discount, 500),
  COALESCE(benefits, perks, '[]'),
  COALESCE(color, '#CD7F32'),
  COALESCE(updated_at, datetime('now'))
FROM tier_configs;

