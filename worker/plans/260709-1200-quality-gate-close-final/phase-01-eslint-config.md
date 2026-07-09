# Phase 1: ESLint Parser Config + Full Lint Sweep

## Requirements
- Install `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin`
- Add `.eslint.config.ts` (flat config, ESLint v10 pattern)
- Run `npx eslint src/ --ext .ts`, fix all warnings

## Files to Create
- `.eslint.config.ts` — flat config with TS parser

## Files to Modify
- `package.json` — add devDependencies
- `package-lock.json` (auto-generated)

## Steps
1. Install parser + plugin
2. Write flat config (ESLint v10 pattern: `export default [...]`)
3. Run lint, fix all warnings
4. Verify 0 errors, 0 warnings on `src/**/*.ts`

## Risks
- Snapshot tests may reference inline snapshots — fix inline
- Some rules (no-console) may flag test helpers — configure per glob
