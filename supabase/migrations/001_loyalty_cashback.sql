-- =====================================================
-- Migration 001: Loyalty & Cashback System
-- Database: Supabase (PostgreSQL)
-- Version: 1.0.0
-- =====================================================

-- ─────────────────────────────────────────────
-- LOYALTY TIERS (reference table)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_tiers (
    tier_name              TEXT PRIMARY KEY,
    min_points             INTEGER NOT NULL DEFAULT 0,
    cashback_rate          DECIMAL(4,2) NOT NULL,
    point_multiplier       DECIMAL(3,1) NOT NULL DEFAULT 1.0,
    birthday_discount      DECIMAL(4,2) DEFAULT 0.10,
    free_upsize_per_week   INTEGER DEFAULT 0,
    priority_booking_hours INTEGER DEFAULT 0,
    benefits_json          JSONB DEFAULT '[]'::jsonb,
    created_at             TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO loyalty_tiers (tier_name, min_points, cashback_rate, point_multiplier, birthday_discount, free_upsize_per_week, priority_booking_hours, benefits_json)
VALUES
  ('Silver', 0, 0.02, 1.0, 0.10, 0, 0, '[
    {"icon":"💰","title":"Cashback 2%","desc":"Hoàn tiền 2% mỗi đơn hàng"},
    {"icon":"⭐","title":"Tích điểm ×1","desc":"Tích điểm tiêu chuẩn"},
    {"icon":"🎂","title":"Giảm 10% sinh nhật","desc":"Giảm 10% trong tháng sinh nhật"}
  ]'::jsonb),
  ('Gold', 500, 0.05, 1.5, 0.30, 1, 24, '[
    {"icon":"💰","title":"Cashback 5%","desc":"Hoàn tiền 5% mỗi đơn hàng"},
    {"icon":"⭐","title":"Tích điểm ×1.5","desc":"Nhân 1.5x điểm mỗi đơn"},
    {"icon":"🎂","title":"Giảm 30% sinh nhật","desc":"Giảm 30% trong tháng sinh nhật"},
    {"icon":"☕","title":"Free upsize","desc":"Upsize miễn phí 1 lần/tuần"},
    {"icon":"🌅","title":"Ưu tiên đặt bàn","desc":"Đặt bàn Rooftop trước 24h"},
    {"icon":"🎁","title":"Quà tặng quý","desc":"Quà tặng bất ngờ mỗi quý"}
  ]'::jsonb),
  ('Platinum', 1000, 0.08, 2.0, 0.50, 99, 48, '[
    {"icon":"💰","title":"Cashback 8%","desc":"Hoàn tiền 8% mỗi đơn hàng"},
    {"icon":"⭐","title":"Tích điểm ×2","desc":"Nhân 2x điểm mỗi đơn"},
    {"icon":"🎂","title":"Giảm 50% sinh nhật","desc":"Giảm 50% + quà đặc biệt"},
    {"icon":"☕","title":"Free upsize không giới hạn","desc":"Upsize miễn phí mọi đơn"},
    {"icon":"🌅","title":"Ưu tiên đặt bàn 48h","desc":"Đặt bàn Rooftop trước 48h"},
    {"icon":"🎁","title":"Quà tặng Premium","desc":"Quà tặng Premium mỗi quý"},
    {"icon":"🎉","title":"Sự kiện VIP","desc":"Tham gia sự kiện VIP exclusive"}
  ]'::jsonb)
ON CONFLICT (tier_name) DO NOTHING;

-- ─────────────────────────────────────────────
-- CASHBACK WALLETS (1:1 with users)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cashback_wallets (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_earned DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_spent  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT positive_balance CHECK (balance >= 0),
    CONSTRAINT earned_gte_spent CHECK (total_earned >= total_spent)
);

CREATE INDEX IF NOT EXISTS idx_cashback_wallets_user ON cashback_wallets(user_id);

-- ─────────────────────────────────────────────
-- CASHBACK TRANSACTIONS (wallet history)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cashback_transactions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id     UUID NOT NULL REFERENCES cashback_wallets(id) ON DELETE CASCADE,
    order_id      UUID REFERENCES orders(id) ON DELETE SET NULL,
    type          TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'bonus', 'expire', 'refund')),
    amount        DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    description   TEXT,
    metadata      JSONB DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cb_tx_wallet    ON cashback_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_cb_tx_order     ON cashback_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_cb_tx_type      ON cashback_transactions(type);
CREATE INDEX IF NOT EXISTS idx_cb_tx_created   ON cashback_transactions(created_at DESC);

-- ─────────────────────────────────────────────
-- LOYALTY POINT LOGS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_point_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id      UUID REFERENCES orders(id) ON DELETE SET NULL,
    points_change INTEGER NOT NULL,
    reason        TEXT NOT NULL CHECK (reason IN ('purchase', 'redeem', 'bonus', 'tier_upgrade', 'expire', 'admin_adjust')),
    balance_after INTEGER NOT NULL,
    description   TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_point_logs_user    ON loyalty_point_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_point_logs_order   ON loyalty_point_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_point_logs_created ON loyalty_point_logs(created_at DESC);

-- ─────────────────────────────────────────────
-- USER REWARDS (claimed vouchers)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_rewards (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_id     UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
    code          TEXT UNIQUE NOT NULL,
    status        TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'locked')),
    expires_at    TIMESTAMPTZ,
    used_at       TIMESTAMPTZ,
    used_on_order UUID REFERENCES orders(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_rewards_user   ON user_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_rewards_status ON user_rewards(status);
CREATE INDEX IF NOT EXISTS idx_user_rewards_code   ON user_rewards(code);

-- ─────────────────────────────────────────────
-- ALTER EXISTING TABLES
-- ─────────────────────────────────────────────

-- users: add email + birthday
DO $$ BEGIN
    ALTER TABLE users ADD COLUMN email TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE users ADD COLUMN birthday DATE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- orders: add loyalty columns
DO $$ BEGIN
    ALTER TABLE orders ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE orders ADD COLUMN cashback_used DECIMAL(10,2) DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE orders ADD COLUMN cashback_earned DECIMAL(10,2) DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE orders ADD COLUMN points_earned INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE orders ADD COLUMN reward_code_used TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

-- ─────────────────────────────────────────────
-- SEED REWARDS
-- ─────────────────────────────────────────────
INSERT INTO rewards (title, discount_type, discount_value, point_cost)
VALUES
  ('Giảm 10% đơn hàng',       'PERCENTAGE',   10,    200),
  ('Giảm 20% đơn hàng',       'PERCENTAGE',   20,    400),
  ('Giảm 50K',                 'FIXED_AMOUNT', 50000, 300),
  ('Combo Sáng miễn phí',     'FIXED_AMOUNT', 89000, 600),
  ('Free Rooftop Seat',        'FIXED_AMOUNT', 0,     500)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- TRIGGER: auto-create wallet on new user
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_wallet_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO cashback_wallets (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_wallet ON users;
CREATE TRIGGER trg_create_wallet
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_wallet_for_new_user();

-- ─────────────────────────────────────────────
-- FUNCTION: process_order_cashback
-- Called after an order is completed
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION process_order_cashback(
    p_order_id UUID,
    p_user_id  UUID
) RETURNS JSONB AS $$
DECLARE
    v_order          RECORD;
    v_user           RECORD;
    v_tier           RECORD;
    v_wallet         RECORD;
    v_cashback       DECIMAL(12,2);
    v_points         INTEGER;
    v_new_total_pts  INTEGER;
    v_new_tier       TEXT;
    v_tier_upgraded  BOOLEAN := FALSE;
    v_next_tier      RECORD;
BEGIN
    -- 1. Get order
    SELECT total_amount, cashback_used
    INTO v_order
    FROM orders WHERE id = p_order_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- 2. Get user + tier config
    SELECT u.*, lt.cashback_rate, lt.point_multiplier
    INTO v_user
    FROM users u
    JOIN loyalty_tiers lt ON lt.tier_name = u.tier
    WHERE u.id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    -- 3. Calculate cashback (exclude cashback_used portion to avoid loop)
    v_cashback := ROUND((v_order.total_amount - COALESCE(v_order.cashback_used, 0)) * v_user.cashback_rate, 2);
    IF v_cashback < 0 THEN v_cashback := 0; END IF;

    -- 4. Calculate points: 1 point per 10,000₫ × multiplier
    v_points := FLOOR(v_order.total_amount / 10000.0 * v_user.point_multiplier);

    -- 5. Update wallet
    SELECT * INTO v_wallet FROM cashback_wallets WHERE user_id = p_user_id FOR UPDATE;

    UPDATE cashback_wallets
    SET balance      = balance + v_cashback,
        total_earned = total_earned + v_cashback,
        updated_at   = NOW()
    WHERE user_id = p_user_id;

    -- 6. Log cashback transaction
    INSERT INTO cashback_transactions (wallet_id, order_id, type, amount, balance_after, description)
    VALUES (v_wallet.id, p_order_id, 'earn', v_cashback, v_wallet.balance + v_cashback,
            'Cashback đơn #' || LEFT(p_order_id::text, 8));

    -- 7. Update user points
    v_new_total_pts := v_user.total_points + v_points;

    UPDATE users
    SET total_points = v_new_total_pts
    WHERE id = p_user_id;

    -- 8. Log points
    INSERT INTO loyalty_point_logs (user_id, order_id, points_change, reason, balance_after, description)
    VALUES (p_user_id, p_order_id, v_points, 'purchase', v_new_total_pts,
            'Tích điểm đơn #' || LEFT(p_order_id::text, 8));

    -- 9. Check tier upgrade
    v_new_tier := v_user.tier;
    SELECT tier_name INTO v_next_tier
    FROM loyalty_tiers
    WHERE min_points <= v_new_total_pts
    ORDER BY min_points DESC
    LIMIT 1;

    IF v_next_tier.tier_name IS NOT NULL AND v_next_tier.tier_name <> v_user.tier THEN
        v_new_tier := v_next_tier.tier_name;
        v_tier_upgraded := TRUE;

        UPDATE users SET tier = v_new_tier WHERE id = p_user_id;

        INSERT INTO loyalty_point_logs (user_id, points_change, reason, balance_after, description)
        VALUES (p_user_id, 0, 'tier_upgrade', v_new_total_pts,
                'Nâng hạng lên ' || v_new_tier);
    END IF;

    -- 10. Update order
    UPDATE orders
    SET cashback_earned = v_cashback,
        points_earned   = v_points
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success',        true,
        'cashback_earned', v_cashback,
        'points_earned',  v_points,
        'wallet_balance', v_wallet.balance + v_cashback,
        'total_points',   v_new_total_pts,
        'tier',           v_new_tier,
        'tier_upgraded',  v_tier_upgraded
    );
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- FUNCTION: spend_cashback
-- Called when user pays with cashback
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION spend_cashback(
    p_user_id  UUID,
    p_order_id UUID,
    p_amount   DECIMAL
) RETURNS JSONB AS $$
DECLARE
    v_wallet     RECORD;
    v_order      RECORD;
    v_max_amount DECIMAL(12,2);
BEGIN
    -- 1. Get wallet
    SELECT * INTO v_wallet FROM cashback_wallets WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    END IF;

    -- 2. Get order
    SELECT total_amount INTO v_order FROM orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- 3. Max 50% of order value
    v_max_amount := ROUND(v_order.total_amount * 0.50, 2);
    IF p_amount > v_max_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tối đa 50% giá trị đơn hàng', 'max_allowed', v_max_amount);
    END IF;

    -- 4. Check balance
    IF p_amount > v_wallet.balance THEN
        RETURN jsonb_build_object('success', false, 'error', 'Số dư không đủ', 'balance', v_wallet.balance);
    END IF;

    -- 5. Deduct
    UPDATE cashback_wallets
    SET balance     = balance - p_amount,
        total_spent = total_spent + p_amount,
        updated_at  = NOW()
    WHERE user_id = p_user_id;

    -- 6. Log
    INSERT INTO cashback_transactions (wallet_id, order_id, type, amount, balance_after, description)
    VALUES (v_wallet.id, p_order_id, 'spend', -p_amount, v_wallet.balance - p_amount,
            'Thanh toán đơn #' || LEFT(p_order_id::text, 8));

    -- 7. Update order
    UPDATE orders SET cashback_used = p_amount WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success',     true,
        'amount_spent', p_amount,
        'new_balance', v_wallet.balance - p_amount
    );
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- VIEW: member summary
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_member_summary AS
SELECT
    u.id,
    u.phone,
    u.full_name,
    u.email,
    u.tier,
    u.total_points,
    u.birthday,
    u.created_at,
    lt.cashback_rate,
    lt.point_multiplier,
    lt.birthday_discount,
    lt.free_upsize_per_week,
    lt.priority_booking_hours,
    lt.benefits_json,
    COALESCE(w.balance, 0)      AS cashback_balance,
    COALESCE(w.total_earned, 0) AS cashback_total_earned,
    COALESCE(w.total_spent, 0)  AS cashback_total_spent,
    nt.tier_name                AS next_tier,
    nt.min_points               AS next_tier_min_points,
    (SELECT COUNT(*) FROM user_rewards ur WHERE ur.user_id = u.id AND ur.status = 'active') AS active_rewards_count
FROM users u
LEFT JOIN loyalty_tiers lt ON lt.tier_name = u.tier
LEFT JOIN cashback_wallets w ON w.user_id = u.id
LEFT JOIN LATERAL (
    SELECT tier_name, min_points
    FROM loyalty_tiers
    WHERE min_points > u.total_points
    ORDER BY min_points ASC
    LIMIT 1
) nt ON TRUE;

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
ALTER TABLE cashback_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashback_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_point_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;

-- Users view own data
CREATE POLICY "Users view own wallet"
    ON cashback_wallets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users view own cashback transactions"
    ON cashback_transactions FOR SELECT
    USING (wallet_id IN (SELECT id FROM cashback_wallets WHERE user_id = auth.uid()));

CREATE POLICY "Users view own point logs"
    ON loyalty_point_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users view own rewards"
    ON user_rewards FOR SELECT
    USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service full access wallets"
    ON cashback_wallets FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service full access cashback tx"
    ON cashback_transactions FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service full access point logs"
    ON loyalty_point_logs FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service full access user rewards"
    ON user_rewards FOR ALL
    USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- REAL-TIME
-- ─────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE cashback_wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE loyalty_point_logs;
