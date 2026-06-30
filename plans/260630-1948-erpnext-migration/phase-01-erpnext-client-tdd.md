# Phase 01 — ERPNext Client (TDD)

**Priority:** P0 | **Status:** done | **Effort:** 8h

## Overview

Write `erpnext-client.js` — REST API wrapper for Frappe/ERPNext. Use TDD: write tests first, then implement.

## Context

- Replaces: `worker/src/clients/odoo-client.js` (614 lines, JSON-RPC)
- ERPNext uses Frappe REST API — token auth, standard CRUD
- All existing callers (`odoo-crm-client.js`, `odoo-product-client.js`, `odoo-accounting-client.js`) depend on this base client

## TDD Steps

### Step 1: Write tests → `tests/erpnext-client.test.js`

```javascript
// Test categories (mirror odoo-client.test.js structure):

// 1. Constructor & config
// - should create client with valid config (url, apiKey, apiSecret)
// - should return null when ERPNEXT_URL is missing
// - should return null when ERPNEXT_API_KEY is missing

// 2. Authentication
// - should include Authorization header with token format
// - should handle 401 unauthorized response
// - should handle 403 forbidden (bad token)

// 3. CRUD operations via REST
// - create(doctype, data) → POST /api/resource/{doctype}
// - read(doctype, name) → GET /api/resource/{doctype}/{name}
// - update(doctype, name, data) → PUT /api/resource/{doctype}/{name}
// - delete(doctype, name) → DELETE /api/resource/{doctype}/{name}
// - list(doctype, params) → GET /api/resource/{doctype}?fields=...&filters=...

// 4. Search/filter (delta sync)
// - searchModified(doctype, since) → filters: [["modified",">",since]]
// - list with pagination (limit_start, limit_page_length)

// 5. Error handling
// - should throw ErpnextError on API error response
// - should throw NetworkError on fetch failure
// - should retry on 429/5xx (max 3 attempts)
// - should timeout after 10s

// 6. Specific ERPNext doctypes
// - createInvoice(order) → POST Sales Invoice
// - getProductAvailability(itemCode) → GET Item + Bin
```

### Step 2: Implement → `worker/src/clients/erpnext-client.js`

```javascript
// Class: ErpnextClient
// Factory: createErpnextClient(env)

// Core methods:
// - constructor({ url, apiKey, apiSecret })
// - async _request(method, path, body) — base fetch wrapper
// - async create(doctype, data)
// - async read(doctype, name)
// - async update(doctype, name, data)
// - async delete(doctype, name)
// - async list(doctype, { fields, filters, limit, offset })
// - async searchModified(doctype, since, fields)
// - async createInvoice(orderData)
// - async getProductAvailability(itemCode)

// Error classes: ErpnextError, NetworkError, MalformedResponseError
```

### Step 3: Verify

- [ ] `tests/erpnext-client.test.js` — all pass
- [ ] `tests/odoo-client.test.js` — still pass (haven't deleted Odoo yet)
- [ ] `npm run lint` — 0 errors
- [ ] No regression in any existing test suite

## API Reference

### Frappe REST API v14/v15

```
Auth: Authorization: token {api_key}:{api_secret}
Base: https://{host}/api

POST /api/resource/{doctype}           — Create
GET  /api/resource/{doctype}/{name}   — Read
PUT  /api/resource/{doctype}/{name}   — Update
DELETE /api/resource/{doctype}/{name} — Delete
GET  /api/resource/{doctype}          — List (query params: fields, filters, limit_start, limit_page_length)

Filters: JSON array [["field","operator","value"],...]
  [["modified",">","2026-06-30"]]
  [["item_code","=","CF001"]]

Special endpoints:
POST /api/method/frappe.client.insert   — Insert with doc
POST /api/method/frappe.client.set_value — Set single field
GET  /api/method/frappe.client.get_value — Get single field
```

## Files

| Action | File |
|--------|------|
| CREATE | `tests/erpnext-client.test.js` |
| CREATE | `worker/src/clients/erpnext-client.js` |
| KEEP | `worker/src/clients/odoo-client.js` (delete in Phase 07) |

## Related

- Odoo client reference: `worker/src/clients/odoo-client.js`
- Odoo test reference: `tests/odoo-client.test.js`
- ERPNext docs: https://docs.erpnext.com/docs/user/manual/en/api
