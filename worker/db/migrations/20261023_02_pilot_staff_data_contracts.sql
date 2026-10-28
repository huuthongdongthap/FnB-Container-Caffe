-- Additive upgrade from the inspected canonical bootstrap/20261014 recruitment topology.
-- Preflight must reject incompatible/already-upgraded schemas before applying this file.
-- No ownership backfill: legacy rows remain NULL until an explicitly reviewed mapping exists.
ALTER TABLE customers ADD COLUMN tenant_id TEXT;
ALTER TABLE recruitment_applications ADD COLUMN tenant_id TEXT;
ALTER TABLE contact_messages ADD COLUMN tenant_id TEXT;
ALTER TABLE contact_messages ADD COLUMN classification TEXT CHECK (classification IN ('contact', 'chat'));
ALTER TABLE staff_shifts ADD COLUMN tenant_id TEXT;
ALTER TABLE staff_shifts ADD COLUMN staff_id TEXT;
ALTER TABLE staff_shifts ADD COLUMN clock_in TEXT;
ALTER TABLE staff_shifts ADD COLUMN clock_out TEXT;
ALTER TABLE staff_shifts ADD COLUMN hours_worked REAL;
ALTER TABLE staff_shifts ADD COLUMN attendance_state TEXT;
ALTER TABLE staff_shifts ADD COLUMN start_time TEXT;
ALTER TABLE staff_shifts ADD COLUMN end_time TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_shifts_one_active ON staff_shifts(tenant_id, staff_id)
  WHERE tenant_id IS NOT NULL AND staff_id IS NOT NULL AND clock_in IS NOT NULL AND clock_out IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_shifts_tenant_date ON staff_shifts(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_recruitment_tenant_created ON recruitment_applications(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_contact_tenant_classification_phone ON contact_messages(tenant_id, classification, phone);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);

CREATE TABLE IF NOT EXISTS resource_creation_requests (
  scope_key TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK(resource_type IN ('customer', 'recruitment')),
  tenant_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
