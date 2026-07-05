---
phase: 2
title: "Complete aura-deploy CLI"
status: completed
priority: P1
dependencies: []
---

# Phase 2: Complete aura-deploy CLI

## Overview

Audit the existing `aura-deploy` CLI at `setup/aura-deploy/` and add the missing `deploy` and `verify` commands. The CLI was scaffolded with Commander, package.json with bin entry, and an `init` command. Need to complete it.

## What Already Exists

| Asset | Location | State |
|---|---|---|
| package.json | `setup/aura-deploy/package.json` | ✅ Has `bin: {"aura-deploy": "./dist/index.js"}`, Commander v12 |
| CLI entry | `setup/aura-deploy/src/index.ts` | ✅ Commander setup, `init` command registered |
| Init command | `setup/aura-deploy/src/commands/init.ts` | ✅ Interactive wizard |
| Template engine | `setup/aura-deploy/src/template/generate.ts` | ✅ Generates brand.json |
| Template index | `setup/aura-deploy/src/template/index.ts` | ✅ Template utilities |
| tsconfig | `setup/aura-deploy/tsconfig.json` | ✅ TypeScript config |

## What's Missing

| Feature | Needed For |
|---|---|
| `deploy` command | Build + CF deploy integration |
| `verify` command | Health check on deployed instance |
| README | Usage documentation |
| Root package.json script alias | `npm run aura-deploy` convenience |

## Implementation Steps

### Step 1: Audit existing CLI (30 min)
- Read `setup/aura-deploy/src/commands/init.ts` to understand the wizard flow
- Read `setup/aura-deploy/src/template/generate.ts` for brand.json output format
- Test `cd setup/aura-deploy && npm install && npm run build` - verify it compiles

### Step 2: Add deploy command (45 min)
- Create `setup/aura-deploy/src/commands/deploy.ts`
- Flow: read brand.json -> `npm run build` -> call `deploy-cloudflare.sh` with brand params
- Accept optional `--project` flag for CF Pages project name
- Print deployment URLs on success

### Step 3: Add verify command (30 min)
- Create `setup/aura-deploy/src/commands/verify.ts`
- Check: DNS resolution, HTTPS certificate, API health (HTTP 200 on /api/health)
- Check: main page loads with correct branding
- Report pass/fail per check

### Step 4: Wire into root project (15 min)
- Add to root `package.json`: `"aura-deploy": "cd setup/aura-deploy && npm run build && node dist/index.js"`
- Create `setup/aura-deploy/README.md` with usage examples

## Related Code Files

- Create: `setup/aura-deploy/src/commands/deploy.ts`
- Create: `setup/aura-deploy/src/commands/verify.ts`
- Create: `setup/aura-deploy/README.md`
- Modify: root `package.json` (add aura-deploy script entry)
- Read: `setup/aura-deploy/src/index.ts` (existing CLI entry)
- Read: `setup/aura-deploy/src/commands/init.ts` (existing init)
- Read: `setup/aura-deploy/src/template/generate.ts` (existing template)

## Related Documentation

- `docs/productization/deployment-checklist.md` - deployment session checklist
- `docs/productization/client-setup-guide.md` - client-facing setup guide
- `deploy-cloudflare.sh` - production deploy script
- `scripts/deploy-branded.sh` - branded deploy script

## Success Criteria

- [ ] `aura-deploy deploy` runs build + CF deploy from brand.json
- [ ] `aura-deploy verify` checks DNS, HTTPS, API, branding
- [ ] Root `npm run aura-deploy` works
- [ ] Existing `aura-deploy init` still works (no regressions)
- [ ] All commands produce bilingual output (VN + EN)

## Risk Assessment

- Low risk - this is adding two commands to an existing, working CLI scaffold
- Deploy command delegates to `deploy-cloudflare.sh` - keep the shell script as the deploy engine, don't duplicate logic
- Verify command uses `curl` + `dig` - standard tools, no new dependencies
