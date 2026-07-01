# Mautic REST API Research Report

## 1. Authentication (Server-to-Server)

**Two methods:**

### OAuth2 Client Credentials (RECOMMENDED for production)
- Create credentials at Settings > API Credentials (Client Credentials grant type).
- Token endpoint: `POST https://{mautic-host}/oauth/v2/token`
  - Body: `grant_type=client_credentials&client_id=xxx&client_secret=xxx`
- Response: `{ "access_token": "...", "expires_in": 3600, "token_type": "bearer" }`
- No refresh token in this flow -- re-authenticate when expired.
- API calls use `Authorization: Bearer {token}` header.

### Basic Auth (dev/simple)
- Must be enabled in Configuration > API Settings (`api_enable_basic_auth => true`).
- `Authorization: Basic {base64(user:password)}` on every request.
- Tied to a Mautic user account.

### Gotcha: FastCGI mode may strip Authorization headers.
Fallback: include `access_token=TOKEN` in POST body (never in URL querystring).

Sources: [Mautic Auth Docs](https://devdocs.mautic.org/en/5.x/rest_api/authentication.html), [GitHub RST](https://github.com/mautic/developer-documentation-new/blob/5.x/docs/rest_api/authentication.rst)

---

## 2. Contacts API

### Single Contact
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/contacts/new` | Create (201) |
| PATCH | `/api/contacts/{id}/edit` | Update (200), fails if missing (404) |
| PUT | `/api/contacts/{id}/edit` | Upsert (200/201), clears unspecified fields |
| GET | `/api/contacts/{id}` | Retrieve |
| DELETE | `/api/contacts/{id}/delete` | Remove (200) |

### Batch Operations
| Method | Endpoint | Notes |
|--------|----------|-------|
| POST | `/api/contacts/batch/new` | Array of contact objects (201) |
| PATCH | `/api/contacts/batch/edit` | Each item must include `id` (200) |
| PUT | `/api/contacts/batch/edit` | Upsert batch |
| DELETE | `/api/contacts/batch/delete?ids=1,2` | Comma-separated IDs (200) |

### Required Fields
- No strictly required fields to create, but `email` is the de facto unique identifier (Mautic dedup uses it).
- Pass any custom field by its alias (e.g., `firstname`, `lastname`, `email`, `title`).
- Custom fields are discovered via `GET /api/contacts/list/fields`.

### Example: Create Contact
```
POST /api/contacts/new
{
  "firstname": "Jane",
  "lastname": "Doe",
  "email": "jane@example.com",
  "overwriteWithBlank": false
}
```

### Tag Management
- Tags in payload: `"tags": ["vip", "restaurant-customer"]`
- Remove a tag: prepend `-` to its name: `"tags": ["-vip"]`

### DNC (Do Not Contact)
- Add: `POST /api/contacts/{id}/dnc/email/add` with `reason: 1|2|3` (UNSUBSCRIBED|BOUNCED|MANUAL)
- Remove: `POST /api/contacts/{id}/dnc/email/remove`

### Source: [Mautic Contacts API Docs](https://github.com/mautic/developer-documentation-new/blob/5.x/docs/rest_api/contacts.rst)

---

## 3. Segments API

### CRUD
| Method | Endpoint |
|--------|----------|
| GET | `/api/segments` (list) |
| GET | `/api/segments/{id}` |
| POST | `/api/segments/new` (create) |
| PATCH | `/api/segments/{id}/edit` |
| DELETE | `/api/segments/{id}/delete` |

### Creating Segments with Filters
```
POST /api/segments/new
{
  "name": "High-Value Customers",
  "isPublished": true,
  "filters": [
    {
      "glue": "and",
      "field": "points",
      "object": "lead",
      "type": "number",
      "operator": "gte",
      "properties": { "filter": "100" }
    }
  ]
}
```

Filter structure: `object` (lead|company|behaviors), `field`, `type` (text|number|date|datetime|email), `operator` (=|!=|gt|gte|lt|lte|like|!like|empty|!empty|in|!in), `properties.filter`.

### Membership Management (SYNC-ABLE)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/segments/{segId}/contact/{contactId}/add` | Add one contact |
| POST | `/api/segments/{segId}/contacts/add` | Add multiple (body: `{ "contactIds": [...] }`) |
| POST | `/api/segments/{segId}/contact/{contactId}/remove` | Remove one contact |

Batch add returns per-contact success/failure:
```
{ "details": { "1": { "success": true }, "2": { "success": false } } }
```

Source: [Mautic Segments API Docs](https://devdocs.mautic.org/en/5.x/rest_api/segments.html)

---

## 4. Campaigns API

### Contact Enrollment
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/campaigns/{campaignId}/contact/{contactId}/add` | Enroll contact (200, `{"success":true}`) |
| POST | `/api/campaigns/{campaignId}/contact/{contactId}/remove` | Remove contact |
| GET | `/api/campaigns/{id}/contacts` | List enrolled contacts |

### No "Trigger Campaign" Endpoint
Campaigns are not triggered ad hoc via API. They fire based on configured entry events. To programmatically trigger a campaign for a contact:
1. Enroll the contact via the endpoint above.
2. Campaign events fire per their config (`triggerMode`: immediate|interval|date).

### Campaign CRUD
| Method | Endpoint |
|--------|----------|
| POST | `/api/campaigns/new` (requires `name`) |
| GET | `/api/campaigns/{id}` |
| DELETE | `/api/campaigns/{id}/delete` |

Source: [Mautic Campaigns API Docs](https://github.com/mautic/developer-documentation-new/blob/5.x/docs/rest_api/campaigns.rst)

---

## 5. Webhooks (Phase B)

### Configurable Webhook Events
Mautic allows selecting event types in Settings > Webhooks. Known event types:

| Event | Trigger |
|-------|---------|
| `mautic.lead_post_save_new` | New contact created/identified |
| `mautic.lead_post_save_update` | Existing contact updated |
| `mautic.lead_post_delete` | Contact deleted |
| `mautic.lead_points_change` | Contact points changed |
| `mautic.email_on_open` | Contact opens an email (tracking pixel) |
| `mautic.email_on_send` | Email sent |
| `mautic.form_on_submit` | Form submitted |
| `mautic.page_on_hit` | Page visited |

### Webhook Payload Format
A single POST contains events grouped by type:
```
{
  "mautic.email_on_open": [ { "contact_id": 123, "email": "..." } ],
  "mautic.lead_post_save_new": [ { "contact": { ... } } ]
}
```

### Gotcha: No native "link clicked" webhook event.
- Link clicks are handled **inside** campaign decision logic (`email.click`), not emitted as webhooks.
- Workaround: Chain a "Send Webhook" campaign action after a "Clicked Link" decision event.

### Gotcha (email tracking): Email open rates are unreliable
- Tracking pixels can be blocked by email clients or triggered by proxy scanners.
- Do not make business decisions solely on open rates.

Sources: [Mautic Webhooks Getting Started](https://devdocs.mautic.org/en/7.1/webhooks/getting_started.html), [TutorialsJoint](https://tutorialsjoint.com/mautic-webhook/)

---

## 6. Gotchas and Pitfalls

| Issue | Impact |
|-------|--------|
| `ipAddress` not saved via API (tracked bug) | Cannot track IP on API-created contacts. Contacts not linked to anonymous sessions. |
| Duplicate user names cause 400 `owner_id` errors | Mautic resolves owner by name, not ID. Ensure unique user names. |
| FastCGI strips `Authorization` header | Need to pass token in POST body as fallback. |
| Field API missing `is_index`/`char_length_limit` in response | Breaks field read-modify-write automation. You must hardcode these. |
| CSRF token canary consumed on IPv6 Docker setups | Add `::/0` to `trusted_proxies` config. |
| PUT clears unspecified fields | Use PATCH for partial updates. PUT replaces everything. |
| Tag removal syntax non-obvious | `"tags": ["-vip"]` not `"tags": []` or a remove endpoint. |
| Client Credentials has no refresh token | Re-auth every 60 min. Must handle token expiry in your sync logic. |
| CRON required for segment rebuild | `mautic:segments:update` must run periodically for dynamic filter-based membership. |

---

## 7. Recommendation for FnB Container Caffe Sync

Architecture: The FnB backend will push contact data to Mautic via the REST API.

1. **Auth**: Use OAuth2 Client Credentials. Store client_id/client_secret as env vars. Implement a token refresh loop (re-auth before expiry).
2. **Contact Sync**: Use `POST /api/contacts/batch/new` for bulk upsert (key on `email`). Use PATCH for individual updates.
3. **Segment Sync**: Use `POST /api/segments/{id}/contact/{contactId}/add` for individual assignments or batch endpoint for bulk. Do NOT rely on dynamic segment filters for external sync -- use manual membership via the add/remove endpoints.
4. **Campaign Enrollment**: After contact sync, enroll via `POST /api/campaigns/{id}/contact/{contactId}/add`. No trigger endpoint exists, so enrollment itself starts the campaign flow.
5. **Phasing**: Phase A needs Auth + Contacts + Segments. Campaign Enrollment and Webhooks are Phase B.

### Unresolved Questions
- Does the Mautic instance have API enabled and at what version? (Auth flow depends on version.)
- Rate limit on the Mautic host? No built-in limit, but reverse proxy may enforce one.
- Segment rebuild CRON schedule on the target Mautic instance? Affects dynamic filter reliability.
- Is the `ipAddress` bug fixed in the Mautic version we will run? If not, we skip IP tracking for API contacts.
