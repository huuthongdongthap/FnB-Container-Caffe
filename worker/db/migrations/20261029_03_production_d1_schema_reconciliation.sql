-- Reconcile production D1 schema where tables pre-existed CREATE TABLE IF NOT EXISTS
-- or where October additive migrations had not yet been applied.

-- 1. Missing durable idempotency and reminder tables
CREATE TABLE IF NOT EXISTS order_creation_requests (
    scope_key TEXT PRIMARY KEY,
    fingerprint TEXT NOT NULL,
    order_id TEXT NOT NULL,
    response_body TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resource_creation_requests (
    scope_key TEXT PRIMARY KEY,
    request_hash TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    resource_type TEXT NOT NULL CHECK(resource_type IN ('customer', 'recruitment')),
    tenant_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sop_reminders (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    template_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    day_key TEXT NOT NULL,
    run_id TEXT,
    staff_id TEXT,
    staff_name TEXT,
    sent_at TEXT NOT NULL,
    acknowledged_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sop_reminders_dedup
    ON sop_reminders(tenant_id, template_id, kind, day_key, COALESCE(run_id, ''));
CREATE INDEX IF NOT EXISTS idx_sop_reminders_run
    ON sop_reminders(tenant_id, run_id);
CREATE INDEX IF NOT EXISTS idx_sop_reminders_open
    ON sop_reminders(tenant_id, acknowledged_at, sent_at);

-- 2. Missing columns on pre-existing customer & loyalty tables
ALTER TABLE customers ADD COLUMN tenant_id TEXT DEFAULT 'default';
ALTER TABLE customers ADD COLUMN verified_at TEXT;
ALTER TABLE customers ADD COLUMN signup_bonus_claimed INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);

ALTER TABLE cashback_wallets ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

ALTER TABLE promotions ADD COLUMN id TEXT;
ALTER TABLE promotions ADD COLUMN name TEXT;
ALTER TABLE promotions ADD COLUMN type TEXT DEFAULT 'percent';
ALTER TABLE promotions ADD COLUMN value REAL;
ALTER TABLE promotions ADD COLUMN applicable_items TEXT;
ALTER TABLE promotions ADD COLUMN applicable_tiers TEXT;
ALTER TABLE promotions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

UPDATE promotions
SET id = 'promo_' || LOWER(code)
WHERE id IS NULL;

ALTER TABLE bonus_campaigns ADD COLUMN type TEXT NOT NULL DEFAULT 'grand_opening';
ALTER TABLE bonus_campaigns ADD COLUMN signup_bonus_claimed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bonus_campaigns ADD COLUMN min_order_for_bonus INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bonus_campaigns ADD COLUMN starts_at TEXT;
ALTER TABLE bonus_campaigns ADD COLUMN ends_at TEXT;
ALTER TABLE bonus_campaigns ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE bonus_campaigns ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

ALTER TABLE signup_bonus_log ADD COLUMN amount_vnd INTEGER NOT NULL DEFAULT 0;
ALTER TABLE signup_bonus_log ADD COLUMN wallet_tx_id TEXT;
ALTER TABLE signup_bonus_log ADD COLUMN phone TEXT;
ALTER TABLE signup_bonus_log ADD COLUMN ip_hint TEXT;
ALTER TABLE signup_bonus_log ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

ALTER TABLE loyalty_audit_log ADD COLUMN event_type TEXT NOT NULL DEFAULT 'audit';
ALTER TABLE loyalty_audit_log ADD COLUMN points_delta INTEGER NOT NULL DEFAULT 0;
ALTER TABLE loyalty_audit_log ADD COLUMN points_after INTEGER NOT NULL DEFAULT 0;
ALTER TABLE loyalty_audit_log ADD COLUMN cashback_delta INTEGER NOT NULL DEFAULT 0;
ALTER TABLE loyalty_audit_log ADD COLUMN cashback_after INTEGER NOT NULL DEFAULT 0;
ALTER TABLE loyalty_audit_log ADD COLUMN tier_before TEXT;
ALTER TABLE loyalty_audit_log ADD COLUMN tier_after TEXT;
ALTER TABLE loyalty_audit_log ADD COLUMN campaign_id TEXT;
ALTER TABLE loyalty_audit_log ADD COLUMN note TEXT;
ALTER TABLE loyalty_audit_log ADD COLUMN actor TEXT;
ALTER TABLE loyalty_audit_log ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

ALTER TABLE orders ADD COLUMN promo_code TEXT;
ALTER TABLE orders ADD COLUMN promotion_code TEXT;
ALTER TABLE orders ADD COLUMN discount_amount INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN loyalty_points_awarded INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN loyalty_reversal_at TEXT;

ALTER TABLE referrals ADD COLUMN tenant_id TEXT DEFAULT 'default';
ALTER TABLE referrals ADD COLUMN referrer_customer_id TEXT;
ALTER TABLE referrals ADD COLUMN referee_customer_id TEXT;
ALTER TABLE referrals ADD COLUMN referrer_bonus_vnd INTEGER DEFAULT 0;
ALTER TABLE referrals ADD COLUMN referee_bonus_vnd INTEGER DEFAULT 0;

-- 3. Rebuild legacy staff_shifts (TEXT PK, NOT NULL staff_email/clock_in) into canonical shift schema
DROP TABLE IF EXISTS staff_shifts;

CREATE TABLE IF NOT EXISTS staff_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    staff_id TEXT NOT NULL,
    staff_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    shift TEXT NOT NULL DEFAULT 'attendance',
    date TEXT NOT NULL,
    clock_in TEXT,
    clock_out TEXT,
    hours_worked REAL,
    attendance_state TEXT DEFAULT 'scheduled',
    start_time TEXT,
    end_time TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_shifts_one_active
    ON staff_shifts(tenant_id, staff_id)
    WHERE tenant_id IS NOT NULL AND staff_id IS NOT NULL AND clock_in IS NOT NULL AND clock_out IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_shifts_tenant_date
    ON staff_shifts(tenant_id, date);

ALTER TABLE contact_messages ADD COLUMN tenant_id TEXT;
ALTER TABLE contact_messages ADD COLUMN classification TEXT CHECK (classification IN ('contact', 'chat'));
CREATE INDEX IF NOT EXISTS idx_contact_tenant_classification_phone
    ON contact_messages(tenant_id, classification, phone);

ALTER TABLE recruitment_applications ADD COLUMN tenant_id TEXT;
CREATE INDEX IF NOT EXISTS idx_recruitment_tenant_created
    ON recruitment_applications(tenant_id, created_at);

ALTER TABLE sop_violations ADD COLUMN sanction_note TEXT;
