--- phase: 1
title: "Self-service Registration + JWT Session"
status: completed
priority: P0
effort: "1d"
dependencies: []
---

# Phase 01: Self-service Registration + JWT Session

## Overview
Enable first-run customers to self-register with phone + password, receive a JWT session cookie, and proceed directly to workspace creation.

## Requirements
- POST /api/auth/register → 201 with user record
- POST /api/auth/session → 200 with session cookie
- Phone uniqueness enforced at DB level
- Bilingual form labels (VN/EN)

## Architecture
- Reuse better-auth session infrastructure.
- New files: worker/src/routes/auth-register.ts (register + send verification), worker/src/routes/auth-verify.ts (verify endpoint), worker/src/routes/auth-session.ts (session refresh).
- Create worker/src/tree/auth/email-verification.ts helper: generate token, store in users.email_verified + users.email_verify_token + users.email_verify_expires.
- Frontend: src/pages/register/index.tsx with locale-aware labels + "Verify email" screen.
- Email provider: Resend or SendGrid (env RESEND_API_KEY / SENDGRID_API_KEY). Template: 6-char code, VN+EN body.

## Related Code Files
- Create: worker/src/routes/auth-register.ts, worker/src/routes/auth-verify.ts, worker/src/routes/auth-session.ts, src/pages/register/index.tsx, src/pages/verify-email/index.tsx
- Create: worker/src/tree/auth/email-verification.ts
- Modify: worker/src/index.ts (mount routes + email verify routes)
- Read: worker/src/tree/auth/better-auth-session.ts, worker/src/routes/auth.ts
- Migration: worker/migrations/012_email_verification.sql (add email_verified, email_verify_token, email_verify_expires to users)

## Implementation Steps
1. Migration 012: add email_verified INTEGER DEFAULT 0, email_verify_token TEXT, email_verify_expires TEXT to users.
2. Create worker/src/tree/auth/email-verification.ts: generateVerifyToken(), verifyEmail(), isExpired().
3. Create auth-register.ts: POST /api/auth/register → insert user with email_verified=0, generate token, send email via Resend/SendGrid, return 201.
4. Create auth-verify.ts: POST /api/auth/verify-email → validate token, set email_verified=1, clear token.
5. Create auth-session.ts: GET /api/auth/session → return user payload including email_verified flag.
6. Mount all routes in worker/src/index.ts.
7. Frontend: src/pages/register/index.tsx (form) + src/pages/verify-email/index.tsx (enter code screen).
8. Add VN/EN labels in i18n for registration + verification screens.

## Success Criteria
- [ ] POST /api/auth/register returns 201, sends verification email
- [ ] POST /api/auth/verify-email marks user verified, returns 200
- [ ] Users with email_verified=0 CANNOT create workspace (Phase 02 gate)
- [ ] Registration + verification forms bilingual VN + EN
- [ ] npm test passes, npm run build: 0 TypeScript errors
