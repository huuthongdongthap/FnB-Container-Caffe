# ADR 0018 — ERPNext CRM Sync Pattern

**Date:** 2026-06-30 | **Status:** Accepted | **Phase:** 3 (CRM)

---

## Context

Customer information needs sync between Aura D1 (loyalty, orders) and ERPNext CRM (leads, customers, tags, notes). Odoo used `crm.lead` model; ERPNext uses `Lead` and `Customer` doctypes with `_user_tags` for tagging.

## Decision

**Event-driven, one-way sync with consent gate.**

1. **Lead creation** — Customer registration triggers `POST /api/resource/Lead` (consent-aware)
2. **Customer creation** — Lead converted to `Customer` doctype via ERPNext standard pipeline
3. **Tag sync** — Loyalty tier changes write `_user_tags` on the Customer doctype (e.g., `loyalty:premium`)
4. **Notes** — Admin note additions POST to `Customer` via REST (notes stored as comments)
5. **Consent gate** — Only sync if `odoo_customer_consent.consent=true` (opt-in), same table reused

## Rationale

- **Same consent gate, same tables** — Migration preserves all data
- **One-way (D1→ERPNext)** — Avoids conflict resolution, same as Odoo ADR-0015
- **_user_tags** — ERPNext native tagging, no custom field needed

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| Two-way sync | Conflict resolution unnecessary for CRM notes |
| Odoo CRM (kept separate) | Unnecessary dual-maintenance |

## Consequences

- **Positive:** Same event triggers, consent flow, and mapper patterns carry over
- **Positive:** Tag-based loyalty display in ERPNext works out of the box
- **Negative:** ERPNext `Lead` → `Customer` conversion is manual or requires automation rule

## Related

- `0016-erpnext-accounting-integration.md`
- `worker/src/clients/erpnext-crm-client.js`
- `worker/src/lib/erpnext-crm-mapper.js`
- `worker/src/routes/erpnext.js`
