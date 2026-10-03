-- Migration Rollback: 20261004_03_autonomous_edge_ops.down.sql
DROP TABLE IF EXISTS customer_support_interactions;
DROP TABLE IF EXISTS container_telemetry_logs;
DROP TABLE IF EXISTS dynamic_pricing_rules;
