---
phase: 1
title: "Auth System"
status: completed
priority: P1
effort: "4h"
dependencies: []
---

# Phase 1: Auth System

## Overview

Build the authentication foundation: Zustand auth store with JWT token management, ProtectedRoute wrapper, Login/Register forms. Every other phase depends on auth being functional.

## Requirements

- Functional: Register new customer account, login with email+password, logout (revoke token), persist JWT across page refresh, redirect unauthenticated users to login
- Non-functional: Token stored in localStorage as `aura_auth`, 401 responses clear auth state, no hardcoded credentials, no token in URL

## Architecture

```
AuthProvider (on mount)
  └─ reads localStorage 'aura_auth' → hydrates use-auth-store
  └─ wraps entire <App />

ProtectedRoute
  └─ reads use-auth-store.token
  └─ if null → <Navigate to="/admin/login" />
  └─ if exists → <Outlet />

api-client.ts (MODIFIED)
  └─ reads use-auth-store.getState().token
  └─ attaches Authorization: Bearer <token> to all requests
  └─ on 401 → use-auth-store.getState().logout()

Flow:
  Register → POST /api/auth/register → receive JWT → store in Zustand + localStorage
  Login → POST /api/auth/login → receive JWT → store in Zustand + localStorage
  Logout → POST /api/auth/logout → clear Zustand + localStorage
  GetMe → GET /api/auth/me → verify token valid, get user profile
```

## Related Code Files

- Create: `src/hooks/stores/use-auth-store.ts`
- Create: `src/components/auth/AuthProvider.tsx`
- Create: `src/components/auth/ProtectedRoute.tsx`
- Create: `src/components/auth/LoginForm.tsx`
- Create: `src/components/auth/RegisterForm.tsx`
- Create: `src/hooks/stores/__tests__/use-auth-store.test.ts`
- Create: `src/components/auth/__tests__/AuthProvider.test.tsx`
- Create: `src/components/auth/__tests__/ProtectedRoute.test.tsx`
- Create: `src/components/auth/__tests__/LoginForm.test.tsx`
- Create: `src/components/auth/__tests__/RegisterForm.test.tsx`
- Create: `src/lib/__tests__/api-client-auth.test.ts`
- Modify: `src/lib/api-client.ts` — add auth token injection
- Modify: `src/App.tsx` — wrap admin routes in ProtectedRoute, add AuthProvider
- Modify: `src/test-utils.tsx` — add AuthProvider to test wrapper

## Implementation Steps

### TDD: Write tests first

1. **`use-auth-store.test.ts`** — Test Zustand store in isolation
   - Initial state: token=null, user=null, loading=false
   - `login()`: calls POST /api/auth/login, stores token + user on success
   - `login()`: sets error state on 401 response
   - `register()`: calls POST /api/auth/register, stores token + user on 201
   - `register()`: sets error on 409 (duplicate email)
   - `logout()`: clears token + user, removes localStorage key
   - `fetchMe()`: calls GET /api/auth/me with stored token
   - localStorage persistence: token survives store re-creation

2. **`ProtectedRoute.test.tsx`** — Test route guard
   - Renders children when token exists
   - Redirects to /admin/login when token is null
   - Redirects to /admin/login when token is expired (401 from /api/auth/me)

2b. **`AuthProvider.test.tsx`** — Test localStorage hydration
   - On mount with valid token in localStorage: hydrates store, calls fetchMe()
   - On mount with expired token: fetchMe() returns 401 → clears auth
   - On mount with no token: sets token=null, no API call
   - On mount with corrupted localStorage data: handles gracefully, sets token=null

2c. **`api-client-auth.test.ts`** — Test auth token injection + 401 handling
   - apiFetch attaches Authorization header when token exists in auth store
   - apiFetch does NOT attach header when token is null
   - On 401 response: calls use-auth-store.getState().logout()
   - On 200 response: returns parsed JSON normally
   - Non-401 errors: throw ApiClientError without clearing auth

3. **`LoginForm.test.tsx`** — Test login UI
   - Renders email + password inputs + submit button
   - Shows validation errors for empty fields
   - Shows API error message on 401
   - Calls login() on submit with valid data
   - Disables button during loading

4. **`RegisterForm.test.tsx`** — Test register UI
   - Renders name + email + phone + password inputs
   - Shows validation for invalid email/phone format
   - Shows API error on 409 (email exists)
   - Calls register() on submit with valid data

### Implement

5. Create `src/hooks/stores/use-auth-store.ts`
   - Zustand store following `use-cart-store.ts` pattern
   - State: `{ token, user, loading, error }`
   - Actions: `login(email, password)`, `register(name, email, phone, password)`, `logout()`, `fetchMe()`
   - localStorage: persist `{ token, user }` under key `aura_auth`
   - Init: read `aura_auth` from localStorage

6. Modify `src/lib/api-client.ts` — add auth token injection
   - `apiFetch()` reads token from `use-auth-store.getState().token`
   - Attaches `Authorization: Bearer <token>` header when token exists
   - On 401 response: call `use-auth-store.getState().logout()`

7. Create `src/components/auth/AuthProvider.tsx`
   - On mount: restore auth from localStorage into Zustand store
   - If token exists, call `fetchMe()` to validate + hydrate user

8. Create `src/components/auth/ProtectedRoute.tsx`
   - Check `use-auth-store.token` — null → `<Navigate to="/admin/login" replace />`
   - Token exists → render children

9. Create `src/components/auth/LoginForm.tsx`
   - Controlled form: email, password
   - Validation: email format, password min 6 chars
   - Submit → `use-auth-store.login()`
   - Loading state: disable button + show spinner
   - Error state: display API error message
   - On success: navigate to `/admin/dashboard`

10. Create `src/components/auth/RegisterForm.tsx`
    - Controlled form: name, email, phone, password, confirm password
    - Validation: all fields required, email format, phone format (VN: 10 digits), passwords match
    - Submit → `use-auth-store.register()`
    - On success: navigate to `/admin/dashboard`

### Integrate

11. Modify `src/App.tsx`
    - Wrap everything in `<AuthProvider>`
    - Wrap admin routes (`/admin/*`) in `<ProtectedRoute>`
    - Add routes: `/admin/login` (public), `/admin/register` (public)

12. Modify `src/test-utils.tsx`
    - Add `AuthProvider` wrapper to `AllProviders`
    - Export `createTestAuthState()` helper to inject mock auth in tests

## Success Criteria

- [ ] 268 existing tests pass (zero regressions)
- [ ] New auth tests pass: use-auth-store, AuthProvider, api-client-auth, ProtectedRoute, LoginForm, RegisterForm
- [ ] User can register → receive JWT → see admin dashboard
- [ ] User can login → receive JWT → see admin dashboard
- [ ] User can logout → JWT cleared → redirected to login
- [ ] Page refresh preserves login state (JWT in localStorage)
- [ ] Unauthenticated user visiting /admin redirects to /admin/login
- [ ] `npm run build` — 0 TypeScript errors
- [ ] No token in URL, no console.log in production code

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Worker CORS blocks SPA origin | Worker CORS middleware already allows all origins. Verify in Phase 6 with integration test |
| Token expiry mid-session | api-client catches 401 → auto-logout. User re-authenticates |
| localStorage unavailable (private browsing) | Store falls back to in-memory only. Auth works for session duration |
| Existing 268 tests break from AuthProvider addition | test-utils.tsx wraps AuthProvider with mock token. All tests stay green |
