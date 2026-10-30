# Phase 02: `packages/domain` Zero-Warning ESLint Convergence

## Context Links
- [Brainstorm Report](../reports/brainstorm-261030-openapi-auth-canonical-d1-and-packages-domain-zero-warning-lint.md)
- `eslint.config.js`
- `package.json`

## Overview
- **Priority:** P1
- **Current Status:** Complete
- **Description:** Enable `'packages/**/*.ts'` in `eslint.config.js`, update `package.json` `"lint"` and `"lint:fix"` scripts to include `packages/` with `--max-warnings=0`, and clean all 27 `@typescript-eslint/no-unused-vars` warnings across 19 files in `packages/domain/`.

## Todo List
- [x] Add `'packages/**/*.ts'` to `eslint.config.js` and `packages/ --max-warnings=0` to `package.json`
- [x] Clean all 27 `@typescript-eslint/no-unused-vars` warnings across 19 files in `packages/domain/`
- [x] Verify `npm run lint` exits 0 with 0 errors and 0 warnings across all 1,859 linted files
