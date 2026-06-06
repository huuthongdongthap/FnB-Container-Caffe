/**
 * Subscription & MRR System Tests — AURA CAFE Container Lease
 *
 * Verifies:
 *  - subscription_plans table (4 container lease tiers)
 *  - subscriptions table (vendor lease contracts)
 *  - mrr_snapshots table (daily MRR tracking)
 *  - subscription_invoices table (payment records)
 *  - Route file exports subscriptionsRouter with all endpoints
 *  - index.js mounts subscriptions at /api/subscriptions
 */

const fs = require('fs');
const path = require('path');
const originalReadFileSync = global.REAL_READ_FILE_SYNC;

const rootDir = path.join(__dirname, '..');

describe('Subscription & MRR System', () => {
  describe('Schema — subscription_plans table', () => {
    const schema = fs.readFileSync(path.join(rootDir, 'worker/schema.sql'), 'utf8');

    test('should CREATE TABLE subscription_plans', () => {
      expect(schema).toContain('CREATE TABLE IF NOT EXISTS subscription_plans');
    });

    test('should have id (TEXT PRIMARY KEY)', () => {
      expect(schema).toContain('id TEXT PRIMARY KEY');
    });

    test('should have slug (UNIQUE NOT NULL)', () => {
      expect(schema).toContain('slug TEXT UNIQUE NOT NULL');
    });

    test('should have monthly_price_vnd (container lease price)', () => {
      expect(schema).toContain('monthly_price_vnd INTEGER NOT NULL');
    });

    test('should have deposit_vnd', () => {
      expect(schema).toContain('deposit_vnd INTEGER DEFAULT 0');
    });

    test('should have container_size (10ft/20ft/40ft)', () => {
      expect(schema).toContain('container_size TEXT NOT NULL');
    });

    test('should have features (JSON array)', () => {
      expect(schema).toContain("features TEXT DEFAULT '[]'");
    });

    test('should have max_occupants, is_popular, is_active', () => {
      expect(schema).toContain('max_occupants INTEGER DEFAULT 1');
      expect(schema).toContain('is_popular INTEGER DEFAULT 0');
      expect(schema).toContain('is_active INTEGER DEFAULT 1');
    });

    test('should have created_at and updated_at timestamps', () => {
      expect(schema).toContain('created_at');
      expect(schema).toContain('updated_at');
    });

    test('should have idx_subscription_plans_slug index', () => {
      expect(schema).toContain('idx_subscription_plans_slug');
    });

    test('should have idx_subscription_plans_active index', () => {
      expect(schema).toContain('idx_subscription_plans_active');
    });
  });

  describe('Schema — subscriptions table', () => {
    const schema = fs.readFileSync(path.join(rootDir, 'worker/schema.sql'), 'utf8');

    test('should CREATE TABLE subscriptions', () => {
      expect(schema).toContain('CREATE TABLE IF NOT EXISTS subscriptions');
    });

    test('should have plan_id foreign key to subscription_plans', () => {
      expect(schema).toContain('plan_id TEXT NOT NULL');
      expect(schema).toContain('REFERENCES subscription_plans(id)');
    });

    test('should have customer_id NOT NULL (FK to customers)', () => {
      expect(schema).toContain('customer_id TEXT NOT NULL');
      expect(schema).toContain('REFERENCES customers(id)');
    });

    test('should have customer_name and customer_phone', () => {
      expect(schema).toContain('customer_name TEXT NOT NULL');
      expect(schema).toContain('customer_phone TEXT NOT NULL');
    });

    test('should have customer_email', () => {
      expect(schema).toContain('customer_email TEXT');
    });

    test('should have container_number and zone', () => {
      expect(schema).toContain('container_number TEXT');
      expect(schema).toContain('zone TEXT');
    });

    test('should have status with default active', () => {
      expect(schema).toContain("status TEXT NOT NULL DEFAULT 'active'");
    });

    test('should have billing_cycle (monthly/quarterly/yearly)', () => {
      expect(schema).toContain("billing_cycle TEXT DEFAULT 'monthly'");
    });

    test('should have current_period_start and current_period_end', () => {
      expect(schema).toContain('current_period_start TEXT NOT NULL');
      expect(schema).toContain('current_period_end TEXT NOT NULL');
    });

    test('should have next_billing_date', () => {
      expect(schema).toContain('next_billing_date TEXT');
    });

    test('should have amount_vnd (MRR contribution)', () => {
      expect(schema).toContain('amount_vnd INTEGER NOT NULL');
    });

    test('should have cancelled_at and cancellation_reason', () => {
      expect(schema).toContain('cancelled_at TEXT');
      expect(schema).toContain('cancellation_reason TEXT');
    });

    test('should have deposit_paid and deposit_vnd', () => {
      expect(schema).toContain('deposit_paid INTEGER DEFAULT 0');
      expect(schema).toContain('deposit_vnd INTEGER DEFAULT 0');
    });

    test('should have idx_subscriptions_status, zone, customer, next_billing indexes', () => {
      expect(schema).toContain('idx_subscriptions_status');
      expect(schema).toContain('idx_subscriptions_zone');
      expect(schema).toContain('idx_subscriptions_customer');
      expect(schema).toContain('idx_subscriptions_next_billing');
    });
  });

  describe('Schema — mrr_snapshots table', () => {
    const schema = fs.readFileSync(path.join(rootDir, 'worker/schema.sql'), 'utf8');

    test('should CREATE TABLE mrr_snapshots', () => {
      expect(schema).toContain('CREATE TABLE IF NOT EXISTS mrr_snapshots');
    });

    test('should have snapshot_date UNIQUE', () => {
      expect(schema).toContain('snapshot_date TEXT NOT NULL UNIQUE');
    });

    test('should have mrr_vnd (active MRR)', () => {
      expect(schema).toContain('mrr_vnd INTEGER NOT NULL DEFAULT 0');
    });

    test('should have arr_vnd (annual recurring revenue)', () => {
      expect(schema).toContain('arr_vnd INTEGER NOT NULL DEFAULT 0');
    });

    test('should have active_subscriptions', () => {
      expect(schema).toContain('active_subscriptions INTEGER NOT NULL DEFAULT 0');
    });

    test('should have new_subscriptions_month', () => {
      expect(schema).toContain('new_subscriptions_month');
    });

    test('should have churned_subscriptions_month', () => {
      expect(schema).toContain('churned_subscriptions_month');
    });

    test('should have expansion_mrr_vnd and contraction_mrr_vnd', () => {
      expect(schema).toContain('expansion_mrr_vnd INTEGER DEFAULT 0');
      expect(schema).toContain('contraction_mrr_vnd INTEGER DEFAULT 0');
    });

    test('should have churn_rate_pct', () => {
      expect(schema).toContain('churn_rate_pct REAL DEFAULT 0');
    });

    test('should have avg_contract_value_vnd', () => {
      expect(schema).toContain('avg_contract_value_vnd INTEGER DEFAULT 0');
    });

    test('should have idx_mrr_snapshots_date index', () => {
      expect(schema).toContain('idx_mrr_snapshots_date ON mrr_snapshots(snapshot_date)');
    });
  });

  describe('Schema — subscription_invoices table', () => {
    const schema = fs.readFileSync(path.join(rootDir, 'worker/schema.sql'), 'utf8');

    test('should CREATE TABLE subscription_invoices', () => {
      expect(schema).toContain('CREATE TABLE IF NOT EXISTS subscription_invoices');
    });

    test('should have subscription_id foreign key', () => {
      expect(schema).toContain('subscription_id TEXT NOT NULL');
      expect(schema).toContain('REFERENCES subscriptions(id)');
    });

    test('should have amount_vnd', () => {
      expect(schema).toContain('amount_vnd INTEGER NOT NULL');
    });

    test('should have status with default pending', () => {
      expect(schema).toContain("status TEXT NOT NULL DEFAULT 'pending'");
    });

    test('should have period_start and period_end', () => {
      expect(schema).toContain('period_start TEXT NOT NULL');
      expect(schema).toContain('period_end TEXT NOT NULL');
    });

    test('should have paid_at, payment_method, payment_ref', () => {
      expect(schema).toContain('paid_at TEXT');
      expect(schema).toContain('payment_method TEXT');
      expect(schema).toContain('payment_ref TEXT');
    });

    test('should have invoice_number UNIQUE', () => {
      expect(schema).toContain('invoice_number TEXT UNIQUE');
    });

    test('should have created_at', () => {
      expect(schema).toContain('created_at TEXT DEFAULT (datetime(');
    });

    test('should have subscription, status, and period indexes', () => {
      expect(schema).toContain('idx_invoices_subscription');
      expect(schema).toContain('idx_invoices_status');
      expect(schema).toContain('idx_invoices_period');
    });
  });

  describe('Schema — Triggers', () => {
    const schema = fs.readFileSync(path.join(rootDir, 'worker/schema.sql'), 'utf8');

    test('should have trigger for subscription_plans updated_at', () => {
      expect(schema).toContain('update_subscription_plans_timestamp');
    });

    test('should have trigger for subscriptions updated_at', () => {
      expect(schema).toContain('update_subscriptions_timestamp');
    });

    test('should have trigger to auto-set next_billing_date on insert', () => {
      expect(schema).toContain('set_next_billing_on_insert');
    });
  });

  describe('Route File — subscriptions.js', () => {
    const routeFile = fs.readFileSync(path.join(rootDir, 'worker/src/routes/subscriptions.js'), 'utf8');

    test('should export subscriptionsRouter (Hono instance)', () => {
      expect(routeFile).toContain('export const subscriptionsRouter');
      expect(routeFile).toContain("new Hono()");
    });

    test('should have GET /plans — list active plans', () => {
      expect(routeFile).toContain("get('/plans'");
    });

    test('should have GET /plans/:id — single plan', () => {
      expect(routeFile).toContain("get('/plans/:id'");
    });

    test('should have POST /plans — create plan (admin)', () => {
      expect(routeFile).toContain("post('/plans'");
    });

    test('should have PUT /plans/:id — update plan (admin)', () => {
      expect(routeFile).toContain("put('/plans/:id'");
    });

    test('should have GET / — list subscriptions', () => {
      expect(routeFile).toContain("get('/'");
    });

    test('should have GET /stats — MRR + churn KPIs', () => {
      expect(routeFile).toContain("get('/stats'");
    });

    test('should have GET /mrr — MRR trend snapshots', () => {
      expect(routeFile).toContain("get('/mrr'");
    });

    test('should have GET /:id — subscription details', () => {
      expect(routeFile).toContain("get('/:id'");
    });

    test('should have POST / — create subscription', () => {
      expect(routeFile).toContain("post('/'");
    });

    test('should have PUT /:id — update subscription', () => {
      expect(routeFile).toContain("put('/:id'");
    });

    test('should have POST /:id/cancel', () => {
      expect(routeFile).toContain("post('/:id/cancel'");
    });

    test('should have POST /:id/pause', () => {
      expect(routeFile).toContain("post('/:id/pause'");
    });

    test('should have POST /:id/resume', () => {
      expect(routeFile).toContain("post('/:id/resume'");
    });

    test('should have DELETE /:id', () => {
      expect(routeFile).toContain("delete('/:id'");
    });

    test('should have invoices list endpoint', () => {
      expect(routeFile).toContain("get('/invoices/list'");
    });

    test('should have invoice pay endpoint', () => {
      expect(routeFile).toContain("post('/invoices/:id/pay'");
    });

    test('should have invoice generate endpoint', () => {
      expect(routeFile).toContain("post('/invoices/generate'");
    });

    test('should use requireAdmin for admin endpoints', () => {
      expect(routeFile).toContain('requireAdmin');
    });

    test('should use requireVendor for vendor endpoints', () => {
      expect(routeFile).toContain('requireVendor');
    });

    test('should call updateMRRSnapshot on state changes', () => {
      expect(routeFile).toContain('updateMRRSnapshot');
    });

    test('should calculate ARR as MRR * 12', () => {
      expect(routeFile).toContain('mrr * 12');
    });

    test('should calculate churn rate', () => {
      expect(routeFile).toContain('churn_rate_pct');
    });

    test('should upsert mrr_snapshots (ON CONFLICT)', () => {
      expect(routeFile).toContain('ON CONFLICT(snapshot_date) DO UPDATE SET');
    });

    test('should prevent deleting active subscriptions', () => {
      expect(routeFile).toContain("sub.status === 'active'");
      expect(routeFile).toContain('use cancel endpoint');
    });

    test('should extend billing period on invoice payment', () => {
      expect(routeFile).toContain("current_period_end = date(current_period_end, '+1 month')");
    });
  });

  describe('Route Registration — index.js', () => {
    const indexJs = fs.readFileSync(path.join(rootDir, 'worker/src/index.js'), 'utf8');

    test('should import subscriptionsRouter', () => {
      expect(indexJs).toContain("import { subscriptionsRouter } from './routes/subscriptions.js'");
    });

    test('should mount subscriptionsRouter at /api/subscriptions', () => {
      expect(indexJs).toContain("app.route('/api/subscriptions', subscriptionsRouter)");
    });
  });

  describe('MRR Calculation Logic', () => {
    const routeFile = fs.readFileSync(path.join(rootDir, 'worker/src/routes/subscriptions.js'), 'utf8');

    test('should SUM amount_vnd for active subscriptions', () => {
      expect(routeFile).toContain("SUM(amount_vnd)");
    });

    test('should COUNT active subscriptions', () => {
      expect(routeFile).toContain("COUNT(*) as count");
      expect(routeFile).toContain("status = 'active'");
    });

    test('should count new subscriptions this month', () => {
      expect(routeFile).toContain('new_this_month');
    });

    test('should count churned subscriptions this month', () => {
      expect(routeFile).toContain("status = \\'cancelled\\'");
      expect(routeFile).toContain('churned_this_month');
    });

    test('should calculate average contract value', () => {
      expect(routeFile).toContain('AVG(amount_vnd)');
    });
  });

  describe('Business Logic — Container Lease', () => {
    const routeFile = fs.readFileSync(path.join(rootDir, 'worker/src/routes/subscriptions.js'), 'utf8');

    test('should generate subscription id with sub_ prefix', () => {
      expect(routeFile).toContain("generateId('sub_'");
    });

    test('should generate invoice id with inv_ prefix', () => {
      expect(routeFile).toContain("generateId('inv_'");
    });

    test('should create first invoice on subscription creation', () => {
      expect(routeFile).toContain('INSERT INTO subscription_invoices');
    });

    test('should generate invoices for due subscriptions', () => {
      expect(routeFile).toContain("next_billing_date <= ?");
    });

    test('should extend period_end by +1 month on payment', () => {
      expect(routeFile).toContain("date(current_period_end, '+1 month')");
    });

    test('should extend period on resume by remaining days', () => {
      expect(routeFile).toContain('remaining');
      expect(routeFile).toContain('setDate');
    });
  });

  describe('File Size & Performance', () => {
    test('subscriptions.js should be under 100KB', () => {
      const content = fs.readFileSync(path.join(rootDir, 'worker/src/routes/subscriptions.js'), 'utf8');
      const sizeKb = Buffer.byteLength(content, 'utf8') / 1024;
      expect(sizeKb).toBeLessThan(100);
    });
  });
});
