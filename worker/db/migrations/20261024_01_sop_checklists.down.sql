-- Rollback for the staff SOP checklist tables.
--
-- Never applied as part of the normal forward flow — this exists only for a
-- deliberate rollback of a bad deploy, so it drops in reverse dependency order:
-- a run item cannot outlive its run, a run cannot outlive its template items,
-- and violations are independent of the checklist chain.

DROP TABLE IF EXISTS sop_run_items;
DROP TABLE IF EXISTS sop_runs;
DROP TABLE IF EXISTS sop_template_items;
DROP TABLE IF EXISTS sop_templates;
DROP TABLE IF EXISTS sop_violations;
