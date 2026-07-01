# Research Report: ERPNext REST API for Cloudflare Workers Integration

**Date:** 2026-06-30  
**Scope:** ERPNext v14 (stable) and v15 (latest) REST API for headless integration  
**Context:** FnB-Container-Caffe project — Cloudflare Workers as middleware between POS/ordering frontends and ERPNext backend

---

## 1. Authentication Methods

### 1.1 Token-Based (API Key + Secret) — RECOMMENDED

The primary and most reliable auth method for server-to-server integration.

**Header format:**
```
Authorization: token <api_key>:<api_secret>
Content-Type: application/json
Accept: application/json
```

**Generation:**
1. Create a dedicated API User in ERPNext (System Manager role, with minimal DocType permissions)
2. Navigate to that user record -> Settings tab -> API Access section
3. Click "Generate Keys" — produces an API Key and API Secret pair
4. API Secret is shown **only once** — store it in Workers Secrets immediately

**cURL example:**
```bash
curl https://your-erpnext.com/api/resource/Customer \
  -H "Authorization: token abc123def456:ghi789jkl012" \
  -H "Content-Type: application/json"
```

**JavaScript/Workers example:**
```js
const ERP_AUTH = `token ${API_KEY}:${API_SECRET}`;
const headers = {
  'Authorization': ERP_AUTH,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};
```

**IMPORTANT V14 quirk:** The `Content-Type: application/json` header is **mandatory** for PUT requests. Omitting it causes PUT to return the document without actually saving changes (known bug, fixed in v15).

### 1.2 Basic Auth (Email + Password)

Also works but is **not recommended** for production integrations:
```
Authorization: Basic base64(email:password)
```
Session cookies may be returned — not suitable for CF Workers stateless model.

### 1.3 OAuth2 (v15 Enhanced, v14 Limited)

Frappe supports OAuth2 via the **Connected App** DocType. Endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/api/method/frappe.integrations.oauth2.authorize` | Authorization code grant |
| `/api/method/frappe.integrations.oauth2.get_token` | Exchange code for access token |
| `/api/method/frappe.integrations.oauth2.revoke_token` | Revoke |

- v14 has basic OAuth2 support (authorization code grant)
- v15 adds PKCE support
- **Verdict:** Adds unnecessary complexity for CF Workers integration. Token-based auth is simpler, more reliable, and has no expiry management. Use API token auth for Workers.

### 1.4 Authentication Ranking for CF Workers

| Method | Rank | Rationale |
|--------|------|-----------|
| Token (API Key + Secret) | **1st** | Stateless, no expiry, simple headers, works identically v14+v15 |
| OAuth2 | 2nd | Overkill for server-to-server; use only if you need per-user scoping |
| Basic Auth | 3rd | Session management not suitable for Workers |

---

## 2. Core API Endpoints

### 2.1 Base URL Pattern

```
https://{your-instance}/api/
```

All DocTypes follow the same RESTful pattern:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/resource/{doctype}` | List documents |
| `POST` | `/api/resource/{doctype}` | Create document |
| `GET` | `/api/resource/{doctype}/{name}` | Read single document |
| `PUT` | `/api/resource/{doctype}/{name}` | Update existing document |
| `DELETE` | `/api/resource/{doctype}/{name}` | Delete document |

### 2.2 Items (Products)

**Endpoint:** `/api/resource/Item`

**GET list with filters & delta sync:**
```
GET /api/resource/Item?filters=[["Item","modified",">=","2026-06-30 00:00:00.0"]]&fields=["name","item_code","item_name","standard_rate","item_group","modified"]
```

**CRITICAL FILTER QUIRK (v14+v15):** When filtering by `modified` timestamp, you **must** append `.0` (fractional seconds) to the timestamp string, otherwise the filter silently returns zero results.

- **Works:** `"2026-06-30 14:30:00.0"`
- **Fails:** `"2026-06-30 14:30:00"` (no fractional seconds — returns empty)

**GET by ID:**
```
GET /api/resource/Item/ITEM-001
```

**POST create:**
```json
POST /api/resource/Item
{
  "item_code": "FNB-001",
  "item_name": "Ca Phe Sua Da",
  "item_group": "Beverages",
  "stock_uom": "Nos",
  "standard_rate": 35000,
  "description": "Vietnamese iced coffee with condensed milk"
}
```

**Search:**
```
GET /api/resource/Item?filters=[["item_name","like","%ca phe%"]]&fields=["name","item_code","item_name","standard_rate"]
```

### 2.3 Sales Orders

**Endpoint:** `/api/resource/Sales%20Order`

**POST create:**
```json
POST /api/resource/Sales Order
{
  "customer": "CUST-00001",
  "company": "Your Company",
  "transaction_date": "2026-06-30",
  "delivery_date": "2026-06-30",
  "currency": "VND",
  "selling_price_list": "Standard Selling",
  "items": [
    {
      "item_code": "FNB-001",
      "qty": 2,
      "rate": 35000,
      "delivery_date": "2026-06-30"
    }
  ],
  "taxes": [
    {
      "charge_type": "On Net Total",
      "account_head": "VAT 10% - CO",
      "rate": 10.0
    }
  ]
}
```

**GET status:**
```
GET /api/resource/Sales Order/SO-2026-00001?fields=["name","status","docstatus","per_delivered","per_billed"]
```

`docstatus` values: 0=Draft, 1=Submitted, 2=Cancelled

**Generate Delivery Note from SO (RPC call):**
```
POST /api/method/erpnext.selling.doctype.sales_order.sales_order.make_delivery_note
Body: {"source_name": "SO-2026-00001"}
```

**Generate Sales Invoice from SO:**
```
POST /api/method/erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice
Body: {"source_name": "SO-2026-00001"}
```

### 2.4 Sales Invoices / Accounting

**Endpoint:** `/api/resource/Sales%20Invoice`

**POST create:**
```json
POST /api/resource/Sales Invoice
{
  "customer": "CUST-00001",
  "company": "Your Company",
  "posting_date": "2026-06-30",
  "due_date": "2026-07-15",
  "currency": "VND",
  "items": [
    {
      "item_code": "FNB-001",
      "qty": 2,
      "rate": 35000
    }
  ],
  "taxes": [
    {
      "charge_type": "On Net Total",
      "account_head": "VAT 10% - CO",
      "rate": 10.0
    }
  ]
}
```

**Create invoice from Delivery Note:**
```
POST /api/method/erpnext.stock.doctype.delivery_note.delivery_note.make_sales_invoice
Body: {"source_name": "DN-2026-00001"}
```

**Payment Entry against invoice:**
```
POST /api/method/erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry
Body: {"dt": "Sales Invoice", "dn": "SI-2026-00001", "party_amount": 77000}
```

### 2.5 CRM Leads / Customers

**Lead:**
```
POST /api/resource/Lead
{
  "lead_name": "Nguyen Van A",
  "company_name": "Coffee Shop HN",
  "email_id": "nguyenvana@example.com",
  "status": "Open",
  "source": "Website Order"
}
```

**Customer:**
```
POST /api/resource/Customer
{
  "customer_name": "Coffee Shop HN",
  "customer_type": "Company",
  "customer_group": "Individual",
  "territory": "Vietnam"
}
```

**Tags (via Tag doctype):**
```
POST /api/resource/Tag
{
  "tag_name": "vip-customer"
}
```
Tags in ERPNext are per-DocType via the `_user_tags` field. Setting tags on an existing doc:
```
PUT /api/resource/Customer/CUST-00001
{
  "_user_tags": "[\"vip-customer\", \"fnb-regular\"]"
}
```

**Notes on documents:**
```
POST /api/method/frappe.client.add_note
Body: {"reference_doctype": "Customer", "reference_name": "CUST-00001", "note": "Prefers Vietnamese coffee only"}
```

### 2.6 Contacts and Addresses

**Contact:**
```
GET/POST /api/resource/Contact
```
```json
POST /api/resource/Contact
{
  "first_name": "Nguyen",
  "last_name": "Van A",
  "email_ids": [{"email_id": "a@example.com", "is_primary": 1}],
  "phone_nos": [{"phone": "+84901234567", "is_primary_phone": 1}],
  "links": [{"link_doctype": "Customer", "link_name": "CUST-00001"}]
}
```

**Address (linked to Customer):**
```
GET/POST /api/resource/Address
```
```json
POST /api/resource/Address
{
  "address_title": "Coffee Shop HN",
  "address_type": "Shipping",
  "address_line1": "42 Pho Hue",
  "city": "Hanoi",
  "country": "Vietnam",
  "pincode": "100000",
  "links": [{"link_doctype": "Customer", "link_name": "CUST-00001"}]
}
```

### 2.7 v15 V2 API (alternative endpoint pattern)

In v15, the V2 API offers enhanced endpoints:

| v1 endpoint | v2 equivalent |
|-------------|---------------|
| `/api/resource/{doctype}` | `/api/v2/document/{doctype}` |
| `/api/resource/{doctype}/{name}` | `/api/v2/document/{doctype}/{name}` |
| `/api/method/{method}` | `/api/v2/method/{method}` |
| N/A | `/api/v2/meta/{doctype}` (schema) |
| N/A | `/api/v2/document/{doctype}/{name}/copy` |
| N/A | `/api/v2/document/{doctype}/count` |

The V2 API is **backward compatible** — you can mix v1 and v2 calls. V2 enables `?expand_links=true` parameter (v1 does support this).

**Recommendation for CF Workers:** Stick with `/api/resource/` (v1) for production — wider documentation, battle-tested. Migrate to `/api/v2/` only if you need metadata lookups or `expand_links`.

---

## 3. Webhook Support

### 3.1 Native Webhook DocType (BUILT-IN, no custom code)

ERPNext has a built-in **Webhook DocType** for outgoing HTTP callbacks. This is production-ready and requires no custom development.

**Configuration fields:**

| Field | Description |
|-------|-------------|
| `webhook_doctype` | DocType that triggers the webhook (e.g., `Sales Order`, `Item`) |
| `webhook_docevent` | Trigger event (see below) |
| `request_url` | Target URL (your CF Worker endpoint) |
| `request_method` | `POST`, `PUT`, or `DELETE` |
| `request_structure` | `Form URL-Encoded` or `JSON` |
| `condition` | Python expression (safe_eval) to conditionally fire |
| `webhook_json` | Jinja template for JSON payload body |
| `webhook_headers` | Child table for custom HTTP headers |
| `enable_security` | Enables HMAC-SHA256 signing |
| `webhook_secret` | Shared secret for HMAC signing |
| `timeout` | Request timeout in seconds (default: 5) |
| `is_dynamic_url` | If true, `request_url` rendered as Jinja template |

**Available events (`webhook_docevent`):**
- `after_insert` — after document is created
- `on_update` — after any save (create or update)
- `on_submit` — after document is submitted (status change to Submitted)
- `on_change` — only on update (not on create)
- `on_cancel` — after document is cancelled
- `on_trash` — after document is deleted

### 3.2 Payload Template (Jinja)

```json
POST https://your-worker.workers.dev/erp-webhook
Content-Type: application/json
X-Frappe-Webhook-Signature: {base64_hmac_sha256}
{
  "event": "{{ doc.doctype }}.{{ event }}",
  "name": "{{ doc.name }}",
  "status": "{{ doc.status }}",
  "docstatus": {{ doc.docstatus }},
  "modified": "{{ doc.modified }}",
  "items": [
    {%- for item in doc.items %}
    {"item_code": "{{ item.item_code }}", "qty": {{ item.qty }}, "rate": {{ item.rate }}}
    {%- if not loop.last %},{% endif %}
    {%- endfor %}
  ]
}
```

### 3.3 Execution Behavior

- **Asynchronous:** Webhooks run in background jobs (enqueued via `frappe.enqueue`), not during the request. External latency does not affect ERPNext response time.
- **Retries:** Up to 3 retries with sleep intervals on HTTP failure.
- **Logging:** Every webhook execution is logged in the **Webhook Request Log** DocType (status, request, response).
- **Deduplication:** Within a single transaction, duplicate triggers are deduplicated.

### 3.4 Security

When `enable_security` is checked:
- Header: `X-Frappe-Webhook-Signature: base64(hmac_sha256(payload, secret))`
- Your CF Worker verifies by recomputing the HMAC with the shared secret and comparing.

**Worker security check:**
```js
async function verifySignature(payload, signature, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, hexToBytes(signature), encoder.encode(payload));
}
```

### 3.5 Recommended Webhook Configuration for Delta Sync

Configure **two** webhooks per relevant DocType:

| DocType | Event | Worker Route | Purpose |
|---------|-------|-------------|---------|
| Item | `on_update` | `/erp-webhook/item` | Product catalog sync |
| Item | `on_trash` | `/erp-webhook/item-delete` | Product deletion |
| Sales Order | `on_submit` | `/erp-webhook/so-submit` | Order confirmed in ERP |
| Sales Invoice | `on_submit` | `/erp-webhook/si-submit` | Invoice finalized |
| Customer | `on_update` | `/erp-webhook/customer` | Customer data sync |

### 3.6 Alternative: Polling via REST API (fallback)

If webhook configuration is blocked (client does not own ERPNext admin), implement polling delta sync:

```
GET /api/resource/Item?filters=[["Item","modified",">=","{last_sync}.0"]]&limit_page_length=100&order_by=modified%20asc
```

Store `last_sync` timestamp per DocType in your Workers KV. Run on a cron trigger (e.g., every 60 seconds via Workers Cron Triggers).

---

## 4. Rate Limiting and Pagination

### 4.1 Rate Limiting

| Aspect | Detail |
|--------|--------|
| **Default limit** | No hard rate limit in Frappe framework itself |
| **Practical limit** | Tied to server resources. Heavily limited by MariaDB connection pool |
| **Concurrent requests** | Frappe Bench processes requests via gunicorn workers (typically 2-4) |
| **Throttling** | NOT built-in for REST API. Optional via nginx level or custom Server Script |
| **Timeout** | Default request timeout for webhooks: 5 seconds |
| **Recommendation** | Implement client-side throttling: max 10 concurrent requests per Worker, 200ms minimum delay between requests |

### 4.2 Pagination

**Parameters:**
| Parameter | Description | Default | Max (practical) |
|-----------|-------------|---------|-----------------|
| `limit_start` | Offset (0-indexed) | 0 | N/A |
| `limit_page_length` | Records per page | **20** | **1000** (framework-enforced ceiling) |
| `order_by` | Sort field + direction | `creation desc` | N/A |

**Pagination pattern:**
```
GET /api/resource/Item?limit_start=0&limit_page_length=100&order_by=modified%20asc
GET /api/resource/Item?limit_start=100&limit_page_length=100&order_by=modified%20asc
```

**Cursor-based pattern for delta sync:**
```
GET /api/resource/Item?filters=[["Item","modified",">=","{last_sync}.0"]]&limit_page_length=100&order_by=modified%20asc
```
Use the `modified` field of the last record as the next cursor. This is more reliable than offset for data that changes between pages.

**Field selection (reduce payload):**
```
GET /api/resource/Item?fields=["name","item_code","item_name","standard_rate","modified"]&limit_page_length=100
```

### 4.3 Filter Operators

| Operator | Example |
|----------|---------|
| `=` | `["status","=","Open"]` |
| `>` | `["amount",">",1000]` |
| `<` | `["amount","<",500]` |
| `>=` | `["modified",">=","2026-06-30 00:00:00.0"]` |
| `<=` | `["modified","<=","2026-06-30 23:59:59.0"]` |
| `between` | `["modified","between",["2026-06-01","2026-06-30"]]` |
| `in` | `["status","in",["Open","Pending"]]` |
| `like` | `["item_name","like","%coffee%"]` |
| `is set` | `["reference","is","set"]` (NOT NULL) |
| `is not set` | `["reference","is","not set"]` (IS NULL) |

**Filter format (works in v14+v15):**
- JSON array of tuples: `[["doctype","field","operator","value"]]`
- OR JSON dict (equality only): `{"status": "Open"}`
- Complex AND/OR via nested arrays

### 4.4 CF Workers Implementation Strategy

For large data volumes, use this pattern:

```
1. Cron trigger (every 60s)
2. Read last_sync cursor from Workers KV
3. Fetch batch: GET /api/resource/{doctype}?filters=...&limit_page_length=100&order_by=modified asc
4. Process records
5. Update last_sync cursor from last record's modified timestamp
6. Iterate until no records returned <= total (if volume > 100, paginate)
```

---

## 5. Python/Frappe Server Requirements

### 5.1 Self-Hosted ERPNext

| Spec | Minimum | Recommended (50 users) | Recommended (200+ users) |
|------|---------|----------------------|--------------------------|
| CPU | 2 cores | 4 cores | 8 cores |
| RAM | **4 GB** | **8 GB** | **16 GB** |
| Storage | **40 GB SSD** | **80 GB SSD** | **200 GB+ SSD** |
| OS | Ubuntu 22.04/24.04 LTS | Ubuntu 22.04/24.04 LTS | Ubuntu 22.04/24.04 LTS |
| Database | MariaDB 10.6+ | MariaDB 10.6+ | MariaDB + read replica |
| Node.js (v15) | Node 18 | Node 18 LTS | Node 18 LTS |

**Key details:**
- **4 GB RAM is the hard minimum** — below this, mariadb + frappe bench + gunicorn compete for memory and swap degrades performance
- **SSD is essential** — MariaDB is I/O intensive. HDD causes significant latency
- Storage grows with **file attachments** (invoices, receipts, product images)
- ERPNext is **NOT stateless** — it runs Python/Frappe on the same machine as the DB. Horizontal scaling requires a separate MariaDB server

### 5.2 Thin-Client Hosting

For the Container Caffe use case specifically:

| Component | Hosting | Notes |
|-----------|---------|-------|
| ERPNext backend | VPS (8GB RAM minimum) | Dedicated Frappe + MariaDB |
| CF Workers | Cloudflare Workers | Stateless API orchestration |
| Static frontend | Cloudflare Pages or Workers | "Container Caffe" customer-facing UI |
| Sync state | Workers KV | Store last_sync cursors, webhook HMAC secrets |

ERPNext **cannot** run on serverless. It is a full Python/Frappe application requiring a persistent MariaDB connection. The Workers layer acts as the middleware, not a replacement.

---

## 6. Summary: Quick Reference Table

| Resource | Endpoint | Key Fields |
|----------|----------|------------|
| Items | `/api/resource/Item` | `item_code`, `item_name`, `standard_rate`, `item_group` |
| Sales Orders | `/api/resource/Sales%20Order` | `customer`, `items[].item_code`, `items[].qty`, `items[].rate` |
| Sales Invoices | `/api/resource/Sales%20Invoice` | `customer`, `posting_date`, `items[].item_code`, `items[].qty`, `items[].rate` |
| Customers | `/api/resource/Customer` | `customer_name`, `customer_type`, `customer_group` |
| Leads | `/api/resource/Lead` | `lead_name`, `company_name`, `email_id`, `status` |
| Contacts | `/api/resource/Contact` | `first_name`, `last_name`, `email_ids`, `links` |
| Addresses | `/api/resource/Address` | `address_line1`, `city`, `country`, `links` |
| Tags | `PUT /api/resource/{doctype}/{name}` | Set `_user_tags` field as JSON array string |
| Notes | `POST /api/method/frappe.client.add_note` | `reference_doctype`, `reference_name`, `note` |

---

## 7. Architectural Assessment for CF Workers

| Consideration | Assessment |
|---------------|------------|
| **Complexity** | Low — REST API is straightforward, no SDK needed |
| **Risk** | Low — API stable across v14 and v15; no breaking changes expected |
| **Auth management** | Easy — API key/secret stored in Workers Secrets; no refresh logic |
| **Delta sync** | Moderate — webhook preferred, polling as fallback |
| **Data formats** | ERPNext operates in "Company" + multi-currency context — ensure POS orders include company, currency |
| **Rate limiting** | Self-hosted = you control the limits; Workers should throttle to 10 concurrent |
| **CF specific** | Workers can call ERPNext directly on your VPS; no tunnel or VPN needed if ERPNext has public HTTPS |

### Key Constraint
ERPNext requires `Content-Type: application/json` on PUT requests (v14 bug). Always set the header.

---

## 8. Sources

- [ERPNext REST API Tutorial (cURL)](https://discuss.frappe.io/t/tutorial-using-curl-for-rest-and-rpc-api-calls/72649) — discuss.frappe.io
- [ERPNext Mobile App Integration Guide](https://nexeves.com/blog/ERPNext/integrating-erpnext-with-mobile-apps-complete-technical-guide) — nexeves.com
- [Frappe Webhook DeepWiki](https://deepwiki.com/frappe/frappe/9.1-webhooks-and-external-integrations) — deepwiki.com (code analysis)
- [ERPNext PUT Not Updating Issue](https://discuss.frappe.io/t/erpnext-api-put-not-updating/96062) — discuss.frappe.io
- [Frappe REST API Documentation (v13)](https://docs.frappe.io/framework/v13/user/en/guides/integration/rest_api/listing_documents) — docs.frappe.io (v15 docs 403; v13 mirrors same pattern)
- [n8n ERPNext Credentials](https://docs.n8n.io/integrations/builtin/credentials/erpnext/) — n8n.io
- [Filter by Modified Timestamp Quirk](https://discuss.frappe.io/t/rest-api-does-only-filter-date-part-of-modified-timestamp/18743) — discuss.frappe.io
- [Frappe Database API (Chinese mirror)](https://erpnext.cc/resource-center/Python%E6%9C%8D%E5%8A%A1%E5%99%A8%E7%AB%AFAPI/DataBase%20API/) — erpnext.cc
- [Frappe V2 API Details (readmex)](https://readmex.com/en-US/frappe/frappe/page-77bcff518-6b9c-4c36-b0b2-89499c8a1b2e) — readmex.com
- Frappe Forum: [Low-end VPS Specs](https://discuss.frappe.io/t/low-end-vps-specification-to-install-erpnext/116039/4), [Hardware Requirements](https://discuss.frappe.io/t/hardware-requirements-for-frappe-erpnext-setup/134991/5), [Generic Installer](https://discuss.frappe.io/t/generic-frappe-erpnext-installer-quick-install/162914)

---

## 9. Unresolved Questions

1. **ERPNext v15 V2 API production stability:** The `/api/v2/` endpoints exist in v15 but have limited community production usage reports. Recommend sticking with `/api/resource/` (v1) until V2 is battle-tested.
2. **Self-hosted SSL certificate handling:** ERPNext self-signed certs may cause `fetch()` failures in Workers. Requires either a valid LetsEncrypt cert or `NODE_TLS_REJECT_UNAUTHORIZED=0` at the Worker level (not ideal).
3. **Webhook payload size limit:** Frappe's default webhook timeout is 5 seconds. A Sales Order with 200 line items may exceed this. Monitor and potentially increase `timeout` on the Webhook doctype.
4. **ERPNext's `_user_tags` field:** Tags are stored as a JSON string on the document's `_user_tags` column, not as a separate Tag record. Setting tags via REST API requires modifying the document itself with `PUT`. Confirm behavior with stock Tag doctype vs the `_user_tags` system tag field.
5. **Concurrent write conflicts:** If Workers and ERPNext UI/backend modify the same document simultaneously, last-write-wins. Investigate `frappe.optimistic_locking` or version check patterns if conflict risk is high.
