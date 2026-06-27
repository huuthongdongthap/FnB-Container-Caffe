/**
 * @jest-test-type stub
 * @todo Phase 3 — Odoo CRM Sync (16h)
 */

xdescribe('Odoo CRM Sync — Phase 3', () => {
  beforeEach(() => {
    throw new Error('NOT_IMPLEMENTED: Phase 3 — Odoo CRM Sync');
  });

  test('odoo-crm-mapper: customer → lead transformation', () => {
    // Will implement: mapCustomerToLead()
    // Verifies: name, phone, email, x_our_customer_id, tag_ids
  });

  test('odoo-crm-mapper: loyalty tier → tag conversion', () => {
    // Will implement: mapLoyaltyTier()
    // Verifies: bronze→Bronze, silver→Silver, gold→Gold, platinum→VIP
  });

  test('CRM: new customer signup → Odoo lead creation', () => {
    // Will implement: POST /api/odoo/leads
    // Verifies: lead created, mapping saved, tags applied
  });

  test('CRM: idempotency — duplicate signup returns existing', () => {
    // Will implement: dedupe by x_our_customer_id
    // Verifies: no duplicate leads
  });

  test('CRM: consent check — skip sync if no consent', () => {
    // Will implement: check consent flag
    // Verifies: no Odoo call if customer opted out
  });

  test('webhook: Odoo contact update → our DB', () => {
    // Will implement: POST /api/webhooks/odoo-crm
    // Verifies: notes, tier updates propagated
  });

  test('backfill: dry-run shows count, skips existing', () => {
    // Will implement: scripts/backfill-odoo-customers.js --dry-run
    // Verifies: counts displayed, no changes made
  });
});
