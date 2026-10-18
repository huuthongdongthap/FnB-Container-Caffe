# Wave 9 Full-Stack Hardening Plan

Comprehensive resilience, schema fallback, state synchronization, and calculation accuracy across worker, domain packages, frontend stores, and UI components.

## Phases

| Phase | Description | Status | File |
|-------|-------------|--------|------|
| 01 | Worker Tree, Integrations, Clients & Durable Objects | Completed | [phase-01-worker-tree-clients-do.md](phase-01-worker-tree-clients-do.md) |
| 02 | Domain Packages Resilient Queries & Policies | Completed | [phase-02-domain-packages-hardening.md](phase-02-domain-packages-hardening.md) |
| 03 | Worker Routes, Middleware & Safe ExecutionContext | Completed | [phase-03-worker-routes-middleware.md](phase-03-worker-routes-middleware.md) |
| 04 | Frontend Stores, Hooks & Offline Storage Resilience | Completed | [phase-04-frontend-stores-hooks.md](phase-04-frontend-stores-hooks.md) |
| 05 | Frontend Pages, Admin Tabs & UI Component Logic | Completed | [phase-05-frontend-pages-components.md](phase-05-frontend-pages-components.md) |

## Key Dependencies
- Phase 01 & 02 operate on backend tree and domain packages with strict file separation.
- Phase 03 secures routing layer, middleware and execution context.
- Phase 04 standardizes frontend data unwrapping and optimistic rollbacks.
- Phase 05 fixes rendering calculation, modal state resets, and UI action wiring.
- Validation: Typecheck (`npm run typecheck:all`), Lint (`npm run lint`), and Unit Tests (`npx vitest run`).
