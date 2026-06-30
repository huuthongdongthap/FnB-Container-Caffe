-- Migration 004: Rename Odoo tables/columns → ERPNext
-- Phase 05 of ERPNext migration plan
-- Run AFTER deploy, when ready to switch from Odoo to ERPNext

-- Rename tables
ALTER TABLE odoo_mappings RENAME TO erpnext_mappings;
ALTER TABLE odoo_sync_logs RENAME TO erpnext_sync_logs;
ALTER TABLE odoo_product_sync RENAME TO erpnext_product_sync;
ALTER TABLE odoo_invoices RENAME TO erpnext_invoices;

-- Rename columns in erpnext_mappings
ALTER TABLE erpnext_mappings RENAME COLUMN odoo_id TO erpnext_id;
ALTER TABLE erpnext_mappings RENAME COLUMN odoo_model TO erpnext_model;

-- Rename columns in erpnext_product_sync
ALTER TABLE erpnext_product_sync RENAME COLUMN odoo_product_id TO erpnext_product_id;
ALTER TABLE erpnext_product_sync RENAME COLUMN odoo_write_date TO erpnext_write_date;

-- Rename columns in erpnext_invoices
ALTER TABLE erpnext_invoices RENAME COLUMN odoo_invoice_id TO erpnext_invoice_id;
