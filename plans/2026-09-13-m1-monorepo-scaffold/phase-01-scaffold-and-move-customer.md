# M1 Batch 4 Phase 1 — Monorepo Scaffold + Move customer → packages/domain/customer

Priority: P0 · Status: COMPLETE · 2026-09-13

## Context

- v4 §20 + phase-map §2 item 1 require `apps/{space,ops,hq}` +
  `packages/domain/*`.
- Blueprint §4.1 (approved 2026-09-12) locked repo shape: **monorepo
  in this repo** — keep history/tests. Fresh `aura/` root rejected.
- `worker/src/tree/customer/` is a clean 6-file module with a public
  `index.ts` shipped in batch 1 (M1 item 2). Already self-contained —
  moving it is the cleanest first exemplar before the heavier tree/
  moves (M2+).
- `worker/src/__tests__/tree/customer/customer-domain.test.ts` is the
  only caller — must keep passing after move.

## Requirements

1. Root `package.json` declares workspaces: `packages/*`, `apps/*`.
2. Create skeleton (placeholders):
   - `packages/domain/customer/package.json` + `tsconfig.json`
   - `packages/domain/crm/` (empty, for phase 2)
   - `apps/space/package.json`, `apps/ops/package.json`,
     `apps/hq/package.json` (placeholders, no content yet)
3. Move `worker/src/tree/customer/*` → `packages/domain/customer/`
   verbatim. Preserve the public surface exactly.
4. Replace `worker/src/tree/customer/index.ts` with a **re-export shim**
   pointing at the moved module, so existing imports (`from
   '...tree/customer'`) and the test keep working without a big-bang
   rewrite of every caller. Old tree/customer stays live and deployable
   until M2 moves callers one by one.
5. Wire tsconfig path alias `@aura/domain-customer` →
   `packages/domain/customer/src` (or root) for vitest + tsc.
6. Gate: full suite + tsc green. No behavior change expected.

## Todo

- [x] Decide workspace tooling → **npm workspaces** (default; already
      what root package.json uses — minimal change, vitest/tsc keep
      working)
- [ ] Edit root `package.json` — add `workspaces: ["packages/*",
      "apps/*"]`, scope `@aura/*` name
- [ ] Create `packages/domain/customer/{package.json,tsconfig.json}`
      and move the 6 customer files in
- [ ] Replace `worker/src/tree/customer/index.ts` with re-export shim
      (re-export everything from `@aura/domain-customer`)
- [ ] Create placeholder `packages/domain/crm/` + `apps/{space,ops,hq}`
- [ ] Add path alias in root `tsconfig.json` + worker `tsconfig.json`
- [ ] Run full suite + tsc, confirm 359 files / 3269 tests green
- [ ] Review + commit

## Success criteria

- `packages/domain/customer/` exists with the same 6 source files that
  were under `worker/src/tree/customer/`; behavior identical.
- Old `worker/src/tree/customer/index.ts` re-exports the moved module —
  callers (`customer-domain.test.ts`, any future importers) keep
  working unchanged.
- `apps/{space,ops,hq}` and `packages/domain/crm` placeholder dirs
  exist with a minimal `package.json` (name + private: true).
- Root `package.json` declares the workspaces array.
- 359 files / 3269 tests green; tsc exit 0.

## Risks

- Workspace tooling mismatch (npm vs pnpm vs bun) → pick one and
  verify `npm install` at root resolves it; keep lockfile consistent.
- Path alias drift between root tsconfig and worker tsconfig →
  keep a single shared base tsconfig that both extend.

## Rollback

- Delete `packages/` + `apps/` dirs, revert root `package.json`,
  restore the original `worker/src/tree/customer/*` from git. Git
  history keeps everything recoverable.
