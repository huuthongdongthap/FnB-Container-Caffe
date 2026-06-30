# Phase 06 — Documentation + ADR Rewrite

**Priority:** P2 | **Status:** done | **Effort:** 3h | **Depends:** Phase 01-05

## ADR Rewrite (3 files)

Create new ERPNext ADRs, keep old Odoo ADRs:

| New ADR | Replaces | Title |
|---------|----------|-------|
| `0016-erpnext-accounting-integration.md` | `0013-odoo-accounting-integration.md` | ERPNext Accounting Integration (REST API, Frappe) |
| `0017-erpnext-pos-sync-pattern.md` | `0014-odoo-pos-sync-pattern.md` | ERPNext POS/Product Sync (Item doctype, Stock) |
| `0018-erpnext-crm-sync-pattern.md` | `0015-odoo-crm-sync-pattern.md` | ERPNext CRM Sync (Lead/Customer, Tags) |

## Docs to Update (~12 files)

| Doc | Change |
|-----|--------|
| `docs/03_ARCHITECTURE.md` | "Odoo"→"ERPNext" in External Integrations, API Routes, Design Decisions |
| `docs/04_ROADMAP.md` | Update Pillar 1: "Odoo"→"ERPNext", effort 40h→45h |
| `docs/12_CHANGELOG.md` | Add ERPNext pivot entry under [Unreleased] |
| `docs/01_GOAL.md` | Update tech stack references |
| `docs/08_BUSINESS_MODEL.md` | Update ERP integration mentions |
| `docs/10_RISK_REGISTER.md` | Update Odoo risks → ERPNext risks |
| `docs/11_GLOSSARY.md` | Add ERPNext entry, deprecate Odoo entry |
| `docs/05_TASKS/integration.md` | Update Pillar 1 and Pillar 5 task descriptions |

## Keep as Historical (no change)

- `docs/06_ADR/0013-*.md`, `0014-*.md`, `0015-*.md` — Odoo ADRs, keep for reference
- `docs/journals/260627-odoo-*.md` — engineering journals, historical
- `plans/*/odoo-*/` — old plan files, historical

## Verification

- [ ] No broken doc links
- [ ] All "Odoo" references in active docs updated to "ERPNext"
- [ ] Historical Odoo files preserved
