# Mekong CLI Conventions for FnB-Container-Caffe

> **Source of truth**: [huuthongdongthap/mekong-cli/.claude/commands/](https://github.com/huuthongdongthap/mekong-cli/tree/main/.claude/commands)
>
> Anh Thông's rule: **All worker plans MUST trigger Mekong CLI slash commands rather than custom bash scripts.**

---

## Why this exists

Mekong CLI is the parent ecosystem (`paths.mekong_cli_root: "../.."` in `mekong.config.yaml`). It exposes 200+ slash commands as DAG pipelines that invoke the right agents (`planner`, `fullstack_developer`, `scout`, `tester`, `debugger`, `git_manager`) with the right protocols.

When we write custom bash scripts that duplicate what Mekong CLI already does, we:
- Bypass the agent system
- Lose the protocol guarantees from `CLAUDE.md`
- Drift from the parent ecosystem
- Make plans non-portable across Mekong tenants

**Therefore**: every plan in `plans/` and every worker dispatch must use slash commands as the unit of work.

---

## Catalog (curated for FnB-Container-Caffe)

### Planning
| Slash command | Purpose | When to use |
|---|---|---|
| `/plan` | Create implementation plan with scout + research | Beginning of any feature/fix |
| `/plan hard` | Deep multi-phase plan with risk analysis | Big architectural changes |
| `/plan fast` | Single-phase plan, bullet steps | Small tweaks, quick fixes |

### Frontend / UI (most relevant for AURA SPACE work)
| Slash command | Purpose |
|---|---|
| `/frontend-ui-build [feature]` | DAG: `/component` → `/cook --frontend` → `/e2e-test` (~12 min) |
| `/frontend-responsive-fix` | Fix responsive issues across breakpoints |
| `/ui-design-component` | Design + scaffold a new component |
| `/ui-design-review` | Review UI/UX of existing component |
| `/design-system` | Apply/update design system tokens |
| `/design-wireframe` | Create wireframe for new feature |

### Dev / QA
| Slash command | Purpose |
|---|---|
| `/dev-feature` | Build a new feature end-to-end |
| `/dev-bug-sprint` | Triage + fix a batch of bugs |
| `/dev-pr-review` | Review an open PR |
| `/qa-e2e` | Run end-to-end tests |
| `/qa-perf` | Performance test (Lighthouse, etc.) |
| `/qa-accessibility` | A11y audit |
| `/qa-regression` | Regression suite |
| `/test` | Quick test run |
| `/code` | Generic code task |
| `/review` | Code review |

### Worker operations (git, push, deploy)
| Slash command | Purpose |
|---|---|
| `/worker-build` | Build the project |
| `/worker-code [task]` | Worker code task |
| `/worker-test` | Worker test run |
| `/worker-commit [scope] [msg]` | Stage + conventional commit |
| `/worker-push` | Push to remote |
| `/worker-rollback` | Rollback to previous state |
| `/worker-trace` | Trace execution |
| `/worker-scan` | Scan for issues |
| `/worker-health` | Health check on worker |
| `/worker-log` | View worker logs |

### Ship / Release
| Slash command | Purpose |
|---|---|
| `/ship` | End-to-end ship pipeline |
| `/release-ship` | Release with versioning |
| `/release-hotfix` | Emergency hotfix release |
| `/deploy` | Deploy to environment |
| `/cloudflare` | Cloudflare-specific deploy |
| `/devops-deploy-pipeline` | Full devops pipeline |

### Marketing / Content (for AURA SPACE marketing suite)
| Slash command | Purpose |
|---|---|
| `/ck-marketing-ads` | Ad copy and creative |
| `/ck-marketing-seo` | SEO optimization |
| `/ck-marketing-local` | Local SEO (Sa Đéc, Đồng Tháp) |
| `/marketing-campaign-run` | Run a marketing campaign |
| `/writer-blog` | Blog post |
| `/writer-newsletter` | Newsletter |
| `/content-social` | Social media content |

---

## How to write a plan that uses Mekong CLI commands

### Bad (custom bash, bypasses ecosystem)
```bash
cd ~/mekong-cli/FnB-Container-Caffe
npm run dev &
curl http://localhost:8082/hero-demo.html
# ... custom logic
git add css/hero-aura.css
git commit -m "tweak"
git push
```

### Good (uses Mekong CLI commands)
```
/plan fast "Verify hero-aura section runs locally and matches AURA SPACE brand"
/frontend-ui-build hero-aura
/qa-e2e hero-demo.html
/worker-commit hero "adjust ripple timing per feedback"
/worker-push
```

The worker reads the plan, then executes each slash command in sequence. Each command knows which agent to invoke (planner, fullstack_developer, tester, git_manager) and what protocol to follow.

---

## Plan file structure (per `/plan` convention)

```
plans/{YYYY-MM-DD}-{slug}/
├── plan.md              # Overview, < 80 lines
├── phase-01-*.md        # First phase detail
├── phase-02-*.md        # Second phase detail
└── ...
```

Each phase file contains:
- Goal
- Slash commands to run (in order)
- Acceptance criteria
- Out-of-scope guardrails

---

## When you don't know which command to use

1. List `.claude/commands/` in the mekong-cli repo
2. Read the command's `.md` file to understand its DAG
3. If still unsure, ask anh Thông — do NOT invent a new command or fall back to custom bash

---

## Maintenance

This file is a **curated subset** for FnB-Container-Caffe. Mekong CLI has 200+ commands; we list only the ones relevant to F&B web work. To see the full catalog:

```bash
ls ~/mekong-cli/.claude/commands/
```

If a new command appears that's relevant, add it here and update memory in Claude conversations.
