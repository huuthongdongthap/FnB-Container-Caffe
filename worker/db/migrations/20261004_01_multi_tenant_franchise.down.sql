-- Multi-Tenant & Franchise Rollback Schema
DROP INDEX IF EXISTS idx_orders_tenant_created;
DROP INDEX IF EXISTS idx_orders_tenant_status;
DROP INDEX IF EXISTS idx_cafe_tables_tenant_num;
DROP INDEX IF EXISTS idx_inventory_items_tenant;
DROP INDEX IF EXISTS idx_reservations_tenant_date;
DROP INDEX IF EXISTS idx_franchise_tenant;
DROP INDEX IF EXISTS idx_franchise_code;
DROP INDEX IF EXISTS idx_franchise_status;
DROP TABLE IF EXISTS franchise_locations;
