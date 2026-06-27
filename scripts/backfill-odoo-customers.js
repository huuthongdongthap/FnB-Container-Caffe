#!/usr/bin/env node
/**
 * Backfill existing customers to Odoo CRM — Phase 3 Stub
 *
 * One-time script to migrate existing customers to Odoo as leads/partners.
 *
 * Usage:
 *   node scripts/backfill-odoo-customers.js --dry-run
 *   node scripts/backfill-odoo-customers.js
 *
 * @todo Phase 3 implementation (16h)
 */

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

console.log('='.repeat(60));
console.log('ODOO CRM BACKFILL SCRIPT — PHASE 3 STUB');
console.log('='.repeat(60));
console.log('');
console.log('⚠️  NOT YET IMPLEMENTED');
console.log('');
console.log('This script will:');
console.log('  1. Fetch all customers from D1 database');
console.log('  2. Filter by consent flag (only sync opt-in customers)');
console.log('  3. For each customer: create Odoo lead + partner');
console.log('  4. Create mapping records in odoo_mappings');
console.log('  5. Log successes and failures');
console.log('');
console.log('Estimated runtime: ~1000 customers → ~30 minutes');
console.log('');

if (dryRun) {
  console.log('📋 DRY-RUN MODE — no changes will be made');
  console.log('');
}

console.log('Implementation steps for Phase 3:');
console.log('  1. Instantiate OdooCrmClient');
console.log('  2. Query D1: SELECT * FROM customers WHERE consent_odoo_sync = 1');
console.log('  3. For each customer:');
console.log('     - mapCustomerToLead(customer)');
console.log('     - odooCrmClient.createLead(mapped)');
console.log('     - Save mapping to odoo_mappings');
console.log('  4. Report: total, success, failures');
console.log('');
console.log('See phase-03-odoo-crm-sync.md for full specification.');
console.log('');
console.log('Stub complete — Phase 3 starts after Phase 1 finishes.');

// Exit with code 0 (stub does nothing)
process.exit(0);
