-- Migration: 20261119_01_saas_commercial_v3.sql
-- Multi-tenant SaaS commercial edition schema parity + SaaS billing, branding, domains, merchant payment configs, and HQ audit logs.

-- -----------------------------------------------------
-- 1. Add missing tenant_id columns and indexes for runtime tenant isolation parity
-- -----------------------------------------------------
ALTER TABLE _metrics ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx__metrics_tenant_id ON _metrics(tenant_id);
ALTER TABLE birthday_redemptions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_birthday_redemptions_tenant_id ON birthday_redemptions(tenant_id);
ALTER TABLE campaign_configs ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_campaign_configs_tenant_id ON campaign_configs(tenant_id);
ALTER TABLE campaign_enrollments ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_tenant_id ON campaign_enrollments(tenant_id);
ALTER TABLE campaign_logs ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_campaign_logs_tenant_id ON campaign_logs(tenant_id);
ALTER TABLE cash_payouts ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_cash_payouts_tenant_id ON cash_payouts(tenant_id);
ALTER TABLE categories ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON categories(tenant_id);
ALTER TABLE category_stations ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_category_stations_tenant_id ON category_stations(tenant_id);
ALTER TABLE consents ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_consents_tenant_id ON consents(tenant_id);
ALTER TABLE cron_jobs ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_cron_jobs_tenant_id ON cron_jobs(tenant_id);
ALTER TABLE cron_runs ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_cron_runs_tenant_id ON cron_runs(tenant_id);
ALTER TABLE customer_events ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_customer_events_tenant_id ON customer_events(tenant_id);
ALTER TABLE customer_identities ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_customer_identities_tenant_id ON customer_identities(tenant_id);
ALTER TABLE dindin_cart ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_dindin_cart_tenant_id ON dindin_cart(tenant_id);
ALTER TABLE dindin_config ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_dindin_config_tenant_id ON dindin_config(tenant_id);
ALTER TABLE erpnext_mappings ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_erpnext_mappings_tenant_id ON erpnext_mappings(tenant_id);
ALTER TABLE erpnext_product_sync ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_erpnext_product_sync_tenant_id ON erpnext_product_sync(tenant_id);
ALTER TABLE erpnext_sync_log ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_erpnext_sync_log_tenant_id ON erpnext_sync_log(tenant_id);
ALTER TABLE erpnext_sync_logs ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_erpnext_sync_logs_tenant_id ON erpnext_sync_logs(tenant_id);
ALTER TABLE erpnext_sync_queue ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_erpnext_sync_queue_tenant_id ON erpnext_sync_queue(tenant_id);
ALTER TABLE erpnext_webhook_log ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_erpnext_webhook_log_tenant_id ON erpnext_webhook_log(tenant_id);
ALTER TABLE expenses ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_id ON expenses(tenant_id);
ALTER TABLE frigate_events ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_frigate_events_tenant_id ON frigate_events(tenant_id);
ALTER TABLE ha_automation_log ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_ha_automation_log_tenant_id ON ha_automation_log(tenant_id);
ALTER TABLE ingredients ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_ingredients_tenant_id ON ingredients(tenant_id);
ALTER TABLE inventory_snapshots ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_tenant_id ON inventory_snapshots(tenant_id);
ALTER TABLE inventory_transactions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_tenant_id ON inventory_transactions(tenant_id);
ALTER TABLE kitchen_stations ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_kitchen_stations_tenant_id ON kitchen_stations(tenant_id);
ALTER TABLE loyalty_accounts ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_tenant_id ON loyalty_accounts(tenant_id);
ALTER TABLE loyalty_point_logs ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_loyalty_point_logs_tenant_id ON loyalty_point_logs(tenant_id);
ALTER TABLE loyalty_redemptions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_tenant_id ON loyalty_redemptions(tenant_id);
ALTER TABLE loyalty_rewards ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_tenant_id ON loyalty_rewards(tenant_id);
ALTER TABLE loyalty_tier_configs ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_loyalty_tier_configs_tenant_id ON loyalty_tier_configs(tenant_id);
ALTER TABLE loyalty_tiers ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_tenant_id ON loyalty_tiers(tenant_id);
ALTER TABLE loyalty_transactions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_tenant_id ON loyalty_transactions(tenant_id);
ALTER TABLE menu_items ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_menu_items_tenant_id ON menu_items(tenant_id);
ALTER TABLE menu_modifiers ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_menu_modifiers_tenant_id ON menu_modifiers(tenant_id);
ALTER TABLE mixpost_posts ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_mixpost_posts_tenant_id ON mixpost_posts(tenant_id);
ALTER TABLE mixpost_templates ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_mixpost_templates_tenant_id ON mixpost_templates(tenant_id);
ALTER TABLE modifier_choices ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_modifier_choices_tenant_id ON modifier_choices(tenant_id);
ALTER TABLE modifier_groups ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_modifier_groups_tenant_id ON modifier_groups(tenant_id);
ALTER TABLE notification_audit_log ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_notification_audit_log_tenant_id ON notification_audit_log(tenant_id);
ALTER TABLE notifications ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON notifications(tenant_id);
ALTER TABLE order_items ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_order_items_tenant_id ON order_items(tenant_id);
ALTER TABLE payment_transactions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_payment_transactions_tenant_id ON payment_transactions(tenant_id);
ALTER TABLE pretix_webhook_log ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_pretix_webhook_log_tenant_id ON pretix_webhook_log(tenant_id);
ALTER TABLE product_modifier_groups ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_product_modifier_groups_tenant_id ON product_modifier_groups(tenant_id);
ALTER TABLE products ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
ALTER TABLE purchase_order_items ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_tenant_id ON purchase_order_items(tenant_id);
ALTER TABLE purchase_orders ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_id ON purchase_orders(tenant_id);
ALTER TABLE push_subscriptions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_tenant_id ON push_subscriptions(tenant_id);
ALTER TABLE recipe_ingredients ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_tenant_id ON recipe_ingredients(tenant_id);
ALTER TABLE recipe_items ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_recipe_items_tenant_id ON recipe_items(tenant_id);
ALTER TABLE recipes ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_recipes_tenant_id ON recipes(tenant_id);
ALTER TABLE reviews ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_reviews_tenant_id ON reviews(tenant_id);
ALTER TABLE rewards ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_rewards_tenant_id ON rewards(tenant_id);
ALTER TABLE sessions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_sessions_tenant_id ON sessions(tenant_id);
ALTER TABLE shift_reconciliations ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_shift_reconciliations_tenant_id ON shift_reconciliations(tenant_id);
ALTER TABLE staff_devices ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_staff_devices_tenant_id ON staff_devices(tenant_id);
ALTER TABLE staff_login_identities ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_staff_login_identities_tenant_id ON staff_login_identities(tenant_id);
ALTER TABLE stock_movements ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_id ON stock_movements(tenant_id);
ALTER TABLE subscription_invoices ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_tenant_id ON subscription_invoices(tenant_id);
ALTER TABLE subscription_plans ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_subscription_plans_tenant_id ON subscription_plans(tenant_id);
ALTER TABLE subscriptions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
ALTER TABLE suppliers ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id ON suppliers(tenant_id);
ALTER TABLE table_qr_codes ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_table_qr_codes_tenant_id ON table_qr_codes(tenant_id);
ALTER TABLE table_sessions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_table_sessions_tenant_id ON table_sessions(tenant_id);
ALTER TABLE ti_menu_cache ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_ti_menu_cache_tenant_id ON ti_menu_cache(tenant_id);
ALTER TABLE tier_configs ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_tier_configs_tenant_id ON tier_configs(tenant_id);
ALTER TABLE trusted_devices ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_trusted_devices_tenant_id ON trusted_devices(tenant_id);
ALTER TABLE user_rewards ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_user_rewards_tenant_id ON user_rewards(tenant_id);
ALTER TABLE visits ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_visits_tenant_id ON visits(tenant_id);
ALTER TABLE wifi_sessions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_wifi_sessions_tenant_id ON wifi_sessions(tenant_id);

-- -----------------------------------------------------
-- 2. Extend saas_tenants with template_id, subdomain, owner metadata, and config
-- -----------------------------------------------------
ALTER TABLE saas_tenants ADD COLUMN template_id TEXT;
ALTER TABLE saas_tenants ADD COLUMN subdomain TEXT;
ALTER TABLE saas_tenants ADD COLUMN owner_email TEXT;
ALTER TABLE saas_tenants ADD COLUMN owner_name TEXT;
ALTER TABLE saas_tenants ADD COLUMN owner_phone TEXT;
ALTER TABLE saas_tenants ADD COLUMN config_json TEXT DEFAULT '{}';
CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_tenants_subdomain ON saas_tenants(subdomain) WHERE subdomain IS NOT NULL;

-- -----------------------------------------------------
-- 3. Tenant Subscriptions (SaaS platform billing, separate from legacy container rentals)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL UNIQUE,
    tier TEXT NOT NULL DEFAULT 'starter',
    billing_cycle TEXT NOT NULL DEFAULT 'monthly',
    status TEXT NOT NULL DEFAULT 'trial',
    trial_ends_at TEXT,
    grace_ends_at TEXT,
    current_period_start TEXT,
    current_period_end TEXT,
    price_vnd INTEGER NOT NULL DEFAULT 199000,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_tenant_id ON tenant_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_status ON tenant_subscriptions(status);

-- -----------------------------------------------------
-- 4. Tenant Branding (storefront, QR, KDS, thermal receipts)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_branding (
    tenant_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    tagline TEXT DEFAULT '',
    logo_url TEXT DEFAULT '',
    primary_color TEXT NOT NULL DEFAULT '#1F2937',
    accent_color TEXT NOT NULL DEFAULT '#D97706',
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    wifi_ssid TEXT DEFAULT '',
    wifi_password TEXT DEFAULT '',
    receipt_footer TEXT DEFAULT 'Cảm ơn quý khách đã ghé thăm!',
    template_id TEXT DEFAULT 'traditional-cafe',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- -----------------------------------------------------
-- 5. Tenant Domains (verified custom domains and subdomains)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_domains (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    domain TEXT NOT NULL UNIQUE,
    domain_type TEXT NOT NULL DEFAULT 'custom',
    verification_token TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    verified_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant_id ON tenant_domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_domains_status ON tenant_domains(status);

-- -----------------------------------------------------
-- 6. Tenant Payment Configs (merchant PayOS AES-256-GCM encrypted or VietQR)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_payment_configs (
    tenant_id TEXT PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT 'vietqr',
    payos_client_id_enc TEXT,
    payos_api_key_enc TEXT,
    payos_checksum_key_enc TEXT,
    key_version INTEGER NOT NULL DEFAULT 1,
    bank_bin TEXT,
    bank_account_no TEXT,
    bank_account_name TEXT,
    bank_name TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- -----------------------------------------------------
-- 7. Platform SaaS Billing Invoices & Ledger (separate from merchant beverage payments)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_invoices (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'pro',
    billing_cycle TEXT NOT NULL DEFAULT 'monthly',
    amount_vnd INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payos_order_code TEXT UNIQUE,
    checkout_url TEXT,
    paid_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tenant_invoices_tenant_id ON tenant_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invoices_status ON tenant_invoices(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_invoices_payos_order_code ON tenant_invoices(payos_order_code);

CREATE TABLE IF NOT EXISTS saas_billing_transactions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    subscription_id TEXT,
    plan_id TEXT NOT NULL,
    billing_cycle TEXT NOT NULL DEFAULT 'monthly',
    amount_vnd INTEGER NOT NULL,
    order_code INTEGER NOT NULL UNIQUE,
    provider TEXT NOT NULL DEFAULT 'payos',
    provider_txn_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    checkout_url TEXT,
    raw_webhook_hash TEXT,
    paid_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_saas_billing_txn_tenant ON saas_billing_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saas_billing_txn_status ON saas_billing_transactions(status);

-- -----------------------------------------------------
-- 8. Platform SaaS Audit Logs (HQ lifecycle actions & tenant changes)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS saas_audit_logs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    actor_user_id TEXT,
    actor_role TEXT,
    action TEXT NOT NULL,
    before_json TEXT,
    after_json TEXT,
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_saas_audit_logs_tenant ON saas_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saas_audit_logs_created ON saas_audit_logs(created_at);

