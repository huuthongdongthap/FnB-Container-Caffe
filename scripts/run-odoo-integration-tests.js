#!/usr/bin/env node
/**
 * Odoo Integration Test Runner
 *
 * Runs Odoo integration tests with mocked Odoo API responses.
 * Usage: node scripts/run-odoo-integration-tests.js
 *
 * @requires Jest installed (npm test)
 * @phase 1-3 — Odoo Integration Testing
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT_DIR = process.cwd();
const TEST_FILES = [
  'tests/odoo-client.test.js',
  'tests/odoo-integration.test.js',
  'tests/odoo-pos-integration.test.js',
  'tests/odoo-crm-sync.test.js'
];

console.log('═'.repeat(60));
console.log('  ODOO INTEGRATION TEST RUNNER');
console.log('═'.repeat(60));
console.log('');

// Check if test files exist
const missingTests = TEST_FILES.filter(f => !require('fs').existsSync(path.join(ROOT_DIR, f)));
if (missingTests.length > 0) {
  console.log('⚠️  Some test files not found:');
  missingTests.forEach(f => console.log(`   - ${f}`));
  console.log('');
  console.log('These will be created in their respective phases:');
  console.log('  Phase 1: odoo-client.test.js, odoo-integration.test.js');
  console.log('  Phase 2: odoo-pos-integration.test.js');
  console.log('  Phase 3: odoo-crm-sync.test.js');
  console.log('');
}

// Run jest with Odoo test pattern
console.log('Running: npm test -- --testPathPattern="odoo" --verbose');
console.log('');

try {
  const result = execSync('npm test -- --testPathPattern=odoo --verbose', {
    stdio: 'inherit',
    cwd: ROOT_DIR
  });
  console.log('');
  console.log('═'.repeat(60));
  console.log('✅ All Odoo integration tests passed');
  console.log('═'.repeat(60));
  process.exit(0);
} catch (error) {
  console.log('');
  console.log('═'.repeat(60));
  console.log('❌ Some Odoo integration tests failed');
  console.log('═'.repeat(60));
  process.exit(1);
}
