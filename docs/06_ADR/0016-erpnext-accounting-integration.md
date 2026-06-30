# ADR 0016 — ERPNext Accounting Integration Approach

**Date:** 2026-06-30 | **Status:** Accepted | **Phase:** 1 (Accounting/E-invoicing)

---

## Context

Aura Cafe needs e-invoicing compliant with Vietnamese regulations. After evaluating Odoo JSON-RPC, ERPNext was chosen as the ERP backend. It uses a REST-first API (Frappe Framework) with token-based authentication.

## Decision

**Replace Odoo JSON-RPC with ERPNext REST API.**

1. **Base client** (`ErpNextClient`): Token-based auth (`Authorization: token {api_key}:{api_secret}`), base URL configurable, JSON request/response
2. **Accounting client** (`ErpNextAccountingClient`): Creates `Sales Invoice` doctype via `POST /api/resource/Sales Invoice`
3. **Retry queue:** Preserved from Odoo — failed calls go to `odoo_sync_failures` table, cron retry every 5 min (max 3 tries)
4. **VAT e-invoice:** Provider TBD (VNPT), triggered after ERPNext invoice creation succeeds

## Rationale

- **REST API** — Standard HTTP, no XML-RPC wrapper needed, easier debugging
- **Token auth** — Simpler than Odoo session-based auth with `uid/password` caching
- **Same table reuse** — `odoo_mappings`, `odoo_invoices`, `odoo_sync_logs` tables reused for ERPNext

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| Odoo (JSON-RPC) | Session auth fragile, schema coupling to Odoo internals |
| Frappe REST + Odoo dual | Adds complexity, no business need for both |
| Direct DB access | Breaks encapsulation, Frappe ORM expected |

## Consequences

- **Positive:** Clean REST interface, no XML parsing, simpler auth
- **Positive:** Reuses existing retry queue, sync logs, and mapping tables
- **Negative:** Still need self-hosted ERPNext instance (Raspberry Pi / VPS)
- **Risk:** ERPNext version upgrades may change REST schema fields

## Related

- `0017-erpnext-pos-sync-pattern.md` — Product/POS sync
- `0018-erpnext-crm-sync-pattern.md` — CRM customer sync
- `worker/src/clients/erpnext-accounting-client.js`
- `worker/src/routes/erpnext-invoices.js`
