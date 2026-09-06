# Phase 02 — Login reads tenant binding; register-staff persists it

## Overview
- Priority: P1 | Status: pending | Depends: Phase 01
- Staff JWT gains tenantId when bound in D1; staff registration accepts optional tenant_id.

## Related Code Files
- Modify: worker/src/tree/auth/login.ts (~line 46: replace/augment saas_tenants-only lookup)
- Modify: worker/src/tree/auth/register-staff.ts (~line 42: KV put + optional D1 upsert)
- Test: worker/src/__tests__/middleware/tenant.test.ts (extend), new tree/auth login-binding test

## Implementation Steps

1. **login.ts** — after password verify:
   - Read `SELECT tenant_id FROM users WHERE id = ?` (D1) → if row has tenant_id, use it
   - Else keep existing `saas_tenants.owner_user_id` fallback (owners)
   - Wrap in existing try/catch (non-fatal, current behavior preserved when D1 empty)
2. **register-staff.ts**:
   - Accept optional `tenant_id` in request body (zod schema update)
   - Store in KV user object + INSERT OR IGNORE into D1 users (id, name, role, phone, tenant_id) — keeps staff-tips join working
3. **Tests** (extend `__tests__/middleware/tenant.test.ts` + auth suite):
   - staff without binding → JWT omits tenantId → middleware resolves 'default' (existing case stays green)
   - staff with D1 tenant_id → claim present → middleware uses it
   - owner path unchanged (saas_tenants fallback still works when users.tenant_id NULL)
   - register-staff with tenant_id persists to KV + D1

## Todo List
- [ ] login.ts dual-source lookup
- [ ] register-staff.ts tenant_id param
- [ ] 4 test cases green

## Success Criteria
- `npx vitest run worker/src/__tests__/middleware/tenant.test.ts` + auth tests PASS
- Full worker suite green (1537 baseline)

## Security Considerations
- tenant_id never accepted from client headers at request time — only at account-provisioning time by owner/admin-authed caller
- Login lookup failure must not block authn (existing non-fatal try/catch pattern)

## Risks
- D1 users row may not exist for KV-created staff → INSERT OR IGNORE covers new staff only; legacy staff stay unbound until next staff edit (acceptable — middleware defaults)
