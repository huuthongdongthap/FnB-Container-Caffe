-- Reconcile pilot store staff login directory and activate the 2026-2027 signup bonus campaign.
-- Password hashes remain NULL so verifyStaffPassword imports each account's PBKDF2 hash
-- from AUTH_KV upon first verified login without storing credentials in migration files.

UPDATE users
SET tenant_id = 'default'
WHERE tenant_id IS NULL OR TRIM(tenant_id) = '';

INSERT OR IGNORE INTO users (
    id, name, role, phone, email, tenant_id, is_active, auth_version, password_hash, created_at, updated_at
) VALUES
    ('USR_OWNER_001', 'AURA Owner', 'owner', '0901234567', 'admin@auraspace.vn', 'default', 1, 1, NULL, datetime('now'), datetime('now')),
    ('USR_morztzcs6p52k', 'Phan Hữu Thông', 'staff', '0915997989', 'huuthong.dongthap@gmail.com', 'default', 1, 1, NULL, datetime('now'), datetime('now')),
    ('USR_morzvfpc50ree', 'Nguyễn Hữu Còn', 'staff', '0986470981', 'gaogavi01@gmail.com', 'default', 1, 1, NULL, datetime('now'), datetime('now'));

UPDATE users
SET email = 'admin@auraspace.vn',
    tenant_id = 'default',
    is_active = 1
WHERE id = 'USR_OWNER_001';

UPDATE users
SET email = 'huuthong.dongthap@gmail.com',
    tenant_id = 'default',
    is_active = 1
WHERE id = 'USR_morztzcs6p52k';

UPDATE users
SET email = 'gaogavi01@gmail.com',
    tenant_id = 'default',
    is_active = 1
WHERE id = 'USR_morzvfpc50ree';

INSERT OR IGNORE INTO staff_login_identities (email, staff_id) VALUES
    ('admin@auraspace.vn', 'USR_OWNER_001'),
    ('huuthong.dongthap@gmail.com', 'USR_morztzcs6p52k'),
    ('gaogavi01@gmail.com', 'USR_morzvfpc50ree');

-- Deactivate pre-launch synthetic test staff accounts (e.g. USR_test_758780),
-- increment auth_version to revoke any pre-existing tokens, and purge orphan or
-- disabled-user rows from staff_login_identities and staff_devices so both
-- db-admin-checklist preflight queries return 0.
UPDATE users
SET is_active = 0,
    auth_version = COALESCE(auth_version, 1) + 1,
    updated_at = datetime('now')
WHERE id LIKE 'USR_test_%';

DELETE FROM staff_login_identities
WHERE staff_id LIKE 'USR_test_%'
   OR staff_id NOT IN (SELECT id FROM users WHERE COALESCE(is_active, 1) = 1);

CREATE TABLE IF NOT EXISTS staff_devices (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    device_name TEXT,
    device_token TEXT UNIQUE NOT NULL,
    pin_hash TEXT NOT NULL DEFAULT '',
    role TEXT DEFAULT 'staff',
    last_login_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

DELETE FROM staff_devices
WHERE staff_id LIKE 'USR_test_%'
   OR staff_id NOT IN (SELECT id FROM users WHERE COALESCE(is_active, 1) = 1);

-- Activate Pilot Store 2026-2027 signup & referral bonus campaign (50.000 VND signup bonus, cap 100, 10.000 VND referral)
INSERT OR IGNORE INTO bonus_campaigns (
    code, name, description, type,
    signup_bonus_vnd, signup_bonus_cap, signup_bonus_claimed,
    refer_bonus_vnd, max_cap_per_customer_vnd, cashback_multiplier, min_order_for_bonus,
    start_date, end_date, starts_at, ends_at,
    active, is_active, tenant_id, created_at
) VALUES (
    'PILOT_LAUNCH_2026',
    'Ưu Đãi Thành Viên Mới AURA SPACE',
    'Tặng 50.000đ vào ví thành viên cho 100 khách hàng đăng ký đầu tiên và 10.000đ thưởng giới thiệu bạn bè.',
    'grand_opening',
    50000, 100, 0,
    10000, 50000, 1, 0,
    '2026-10-01 00:00:00', '2027-12-31 23:59:59',
    '2026-10-01T00:00:00.000Z', '2027-12-31T23:59:59.000Z',
    1, 1, 'default', datetime('now')
);

UPDATE bonus_campaigns
SET active = 1,
    is_active = 1,
    signup_bonus_vnd = 50000,
    signup_bonus_cap = 100,
    refer_bonus_vnd = 10000,
    max_cap_per_customer_vnd = 50000,
    start_date = '2026-10-01 00:00:00',
    end_date = '2027-12-31 23:59:59',
    starts_at = '2026-10-01T00:00:00.000Z',
    ends_at = '2027-12-31T23:59:59.000Z',
    tenant_id = 'default'
WHERE code = 'PILOT_LAUNCH_2026';
