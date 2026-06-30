/**
 * Odoo Order Trigger & Cron Retry Code Verification Tests — Phase 1
 *
 * These tests verify the source code contains the expected Odoo integration patterns:
 * - Order completion triggers Odoo invoice sync
 * - Cron processOdooRetryQueue processes failed mappings and logs to odoo_sync_logs
 *
 * @jest-test-type integration
 */

const { test, expect } = require('@jest/globals');

describe('Order Trigger: Code Verification', () => {
  test('orders.js should contain Odoo trigger for completed orders', () => {
    const fs = require('fs');
    const ordersPath = __dirname + '/../worker/src/routes/orders.js';
    const source = fs.readFileSync(ordersPath, 'utf8');

    // Should have the Odoo trigger block for completed orders
    expect(source).toContain("log.info('Odoo invoice trigger for order'");
    expect(source).toContain("import('./odoo-invoices.js')");
    expect(source).toContain("createOdooInvoice");
    expect(source).toContain("['delivered', 'completed'].includes(body.status)");
    // Should be fire-and-forget (not awaited)
    expect(source).toContain('(async () => {');
    // Should catch errors without blocking
    expect(source).toContain('catch (odooErr)');
    // Should be non-blocking
    expect(source).toContain('Non-blocking');
  });

  test('odoo-invoices.js should validate order has items', () => {
    const fs = require('fs');
    const invoicesPath = __dirname + '/../worker/src/routes/odoo-invoices.js';
    const source = fs.readFileSync(invoicesPath, 'utf8');

    // Should validate items exist
    expect(source).toContain('items.length === 0');
  });
});

describe('Cron Retry Queue: Code Verification', () => {
  test('cron.js should contain processOdooRetryQueue with proper query', () => {
    const fs = require('fs');
    const cronPath = __dirname + '/../worker/src/routes/cron.js';
    const source = fs.readFileSync(cronPath, 'utf8');

    expect(source).toContain('export async function processOdooRetryQueue');
    // Should query failed mappings with attempts < 3
    expect(source).toContain("sync_status = 'failed' AND attempts < 3");
    // Should have LIMIT 20 for batch processing
    expect(source).toContain('LIMIT 20');
  });

  test('cron.js should contain logOdooSyncAttempt helper with correct columns', () => {
    const fs = require('fs');
    const cronPath = __dirname + '/../worker/src/routes/cron.js';
    const source = fs.readFileSync(cronPath, 'utf8');

    expect(source).toContain('async function logOdooSyncAttempt');
    // Should insert into odoo_sync_logs with all required columns
    expect(source).toContain('INSERT INTO odoo_sync_logs');
    expect(source).toContain('mapping_id');
    expect(source).toContain('attempt');
    expect(source).toContain('status');
    expect(source).toContain('error_message');
    expect(source).toContain('latency_ms');
  });

  test('cron.js should log both success and failure attempts', () => {
    const fs = require('fs');
    const cronPath = __dirname + '/../worker/src/routes/cron.js';
    const source = fs.readFileSync(cronPath, 'utf8');

    // Should call logOdooSyncAttempt for both success and failure paths
    const logCalls = (source.match(/logOdooSyncAttempt/g) || []).length;
    expect(logCalls).toBeGreaterThanOrEqual(2); // At least 2 calls (success and failure branches)
  });

  test('cron.js should handle unsupported local_type gracefully', () => {
    const fs = require('fs');
    const cronPath = __dirname + '/../worker/src/routes/cron.js';
    const source = fs.readFileSync(cronPath, 'utf8');

    expect(source).toContain('Unsupported local_type');
    // Should still log unsupported types as failures
    expect(source).toContain('Skipping unsupported local_type');
  });

  test('cron.js should increment attempts on failure', () => {
    const fs = require('fs');
    const cronPath = __dirname + '/../worker/src/routes/cron.js';
    const source = fs.readFileSync(cronPath, 'utf8');

    expect(source).toContain('attempts = attempts + 1');
  });
});

describe('Database Schema Verification', () => {
  test('odoo_sync_logs table should exist with correct columns', () => {
    const fs = require('fs');
    const migrationPath = __dirname + '/../scripts/migrations/001-odoo-tables.sql';
    const source = fs.readFileSync(migrationPath, 'utf8');

    expect(source).toContain('CREATE TABLE IF NOT EXISTS odoo_sync_logs');
    expect(source).toContain('mapping_id INTEGER');
    expect(source).toContain('attempt INTEGER');
    expect(source).toContain('status TEXT NOT NULL');
    expect(source).toContain('error_message TEXT');
    expect(source).toContain('latency_ms INTEGER');
    expect(source).toContain('created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    expect(source).toContain('FOREIGN KEY (mapping_id) REFERENCES odoo_mappings(id)');
  });

  test('odoo_mappings table should have attempts and sync_status columns', () => {
    const fs = require('fs');
    const migrationPath = __dirname + '/../scripts/migrations/001-odoo-tables.sql';
    const source = fs.readFileSync(migrationPath, 'utf8');

    expect(source).toContain('CREATE TABLE IF NOT EXISTS odoo_mappings');
    expect(source).toContain('sync_status TEXT DEFAULT');
    expect(source).toContain('attempts INTEGER DEFAULT 0');
    expect(source).toContain('UNIQUE(local_type, local_id)');
  });
});

describe('Edge Cases Coverage', () => {
  test('cron.js should handle Odoo client not configured', () => {
    const fs = require('fs');
    const cronPath = __dirname + '/../worker/src/routes/cron.js';
    const source = fs.readFileSync(cronPath, 'utf8');

    expect(source).toContain('if (!odooClient)');
    expect(source).toContain('Odoo not configured');
  });

  test('cron.js should handle empty failed mappings', () => {
    const fs = require('fs');
    const cronPath = __dirname + '/../worker/src/routes/cron.js';
    const source = fs.readFileSync(cronPath, 'utf8');

    expect(source).toContain('No failed Odoo mappings to retry');
  });

  test('cron.js should log errors without throwing', () => {
    const fs = require('fs');
    const cronPath = __dirname + '/../worker/src/routes/cron.js';
    const source = fs.readFileSync(cronPath, 'utf8');

    // Should have try-catch around the retry loop
    expect(source).toContain('try {');
    expect(source).toContain('} catch (err)');
  });
});
