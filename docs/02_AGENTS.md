---
date: 2025-06-19
version: 1.0
status: stable
---

# AGENTS — Mekong CLI Agent Catalog

## Overview

This project uses **Mekong CLI agent system** for automated development workflows. Each agent has specific responsibilities, activation triggers, and expected outputs.

---

## Agent Catalog

| Agent | Role | Activation | Primary Output |
|-------|------|------------|----------------|
| `planner` | Task decomposition & planning | `/plan`, auto-execute | `plans/` directory with phase files |
| `scout` | Codebase exploration | `/ck:scout`, auto on task start | Scout report (files, patterns, dependencies) |
| `researcher` | Domain research | `/research`, parallel in planning | Research reports (sources, analysis) |
| `fullstack-developer` | Implementation | `/ck:cook`, phase execution | Feature code (HTML/JS/CSS/Worker routes) |
| `tester` | Test generation & execution | `/ck:test`, post-implementation | Test suites (Jest/Playwright), coverage reports |
| `code-reviewer` | Code quality review | `/ck:code-review` | Review report (bugs, improvements, security) |
| `debugger` | Bug investigation | `/ck:debug`, `/ck:fix` | Debug report (root cause, fix recommendations) |
| `git-manager` | Git operations | Auto on commit/push | Commits, branches, PRs (conventional format) |
| `docs-manager` | Documentation | `/ck:docs`, doc tasks | Docs in `/docs/` per template |
| `security-scan` | Security audit | `/ck:security`, `/ck:security-scan` | Security report (vulnerabilities, fixes) |
| `project-manager` | Roadmap & tasks | `/ck:plan` phases, `/ck:roadmap` | `04_ROADMAP.md`, `05_TASKS/` |
| `architect` | Architecture decisions | `/ck:plan` architecture phase | `03_ARCHITECTURE.md`, `06_ADR/` |

---

## Agent Details

### planner
**Purpose:** Decompose user requirements into actionable implementation phases.

**Activation triggers:**
- `/plan` command with goal description
- Auto-execute when `auto_execute: true` in `mekong.config.yaml`

**Responsibilities:**
- Analyze existing codebase (via `scout` subagent)
- Research relevant technologies (via parallel `researcher` agents)
- Create `plans/<timestamp>-slug/` directory
- Generate `plan.md` overview + `phase-XX-name.md` files per phase
- Define TODO lists, success criteria, risk assessment per phase

**Expected output:**
- `plans/<timestamp>-slug/plan.md` (summary)
- `plans/<timestamp>-slug/phase-01-*.md` through `phase-N-*.md`
- `plans/reports/planner-<date>-<slug>-report.md`

**Configuration:** `mekong.config.yaml → agents.planner`

---

### scout
**Purpose:** Discover and map existing codebase structure.

**Activation triggers:**
- `/ck:scout` explicitly
- Auto-invoked by `planner` agent at planning start

**Responsibilities:**
- Inventory files by directory
- Identify key files (config, routes, models)
- Map dependencies and data flows
- Report existing patterns and tech debt

**Expected output:**
- Scout report with file tree, key findings, code snippets
- Path references in `path:line` format

**Configuration:** `mekong.config.yaml → agents.scout.codebase_path`

---

### researcher
**Purpose:** Conduct deep research on technical or domain topics.

**Activation triggers:**
- `/research` command (parallelized)
- Auto-invoked by `planner` for multiple research topics

**Responsibilities:**
- Search documentation (via `docs-seeker`)
- Fetch authoritative sources (web search, official docs)
- Synthesize findings with citations
- Report back to `planner` with recommendations

**Sources configured:** `industry`, `local-market`, `fnb-trends` (from `mekong.config.yaml`)

**Expected output:**
- `plans/<timestamp>/research/researcher-XX-report.md`

---

### fullstack-developer
**Purpose:** Implement features across frontend and backend.

**Activation triggers:**
- `/ck:cook` command executing a plan phase
- `/dev-feature` command

**Responsibilities:**
- Read phase specifications from plan file
- Implement code per implementation steps
- Follow code standards (`./docs/code-standards.md`)
- Run compile/lint checks after changes
- Update related docs (if instructed)

**Stack:** HTML, CSS, JavaScript, Docker (from `mekong.config.yaml`)

**Expected output:**
- Modified files (Edit chunks, not full rewrites)
- New files in appropriate locations
- Commit-ready changes

---

### tester
**Purpose:** Write and run tests, ensure code quality.

**Activation triggers:**
- `/ck:test` command
- Auto-invoked after implementation in `/dev-feature` workflow

**Responsibilities:**
- Write unit tests (Jest) for new/modified code
- Write integration/E2E tests (Playwright) for user flows
- Run test suite and generate coverage report
- Analyze failures and report to developer
- Verify all tests pass before "ship"

**Coverage threshold:** 80% (from `mekong.config.yaml → tester.coverage_threshold`)

**Expected output:**
- Test files (`*.test.js`, `*.spec.js`)
- Coverage reports (`coverage/lcov-report/`)
- Test result summaries

---

### code-reviewer
**Purpose:** Review code for quality, security, performance.

**Activation triggers:**
- `/ck:code-review` command
- Auto-invoked before `/ship` in workflow

**Responsibilities:**
- Architecture check (SOLID, separation of concerns)
- Security scan (OWASP patterns, secrets leakage)
- Performance analysis (N+1 queries, unnecessary re-renders)
- Code style and maintainability
- Generate review report with actionable findings

**Expected output:**
- Review report in `plans/reviews/` or inline PR comments
- Risk assessment
- Recommendations for fixes

---

### debugger
**Purpose:** Investigate bugs and CI/CD failures.

**Activation triggers:**
- `/ck:debug` command
- Auto-invoked by `/ck:fix` workflow

**Responsibilities:**
- Reproduce the issue locally or in test environment
- Analyze logs, stack traces, test failures
- Identify root cause
- Recommend fix strategy
- Optionally implement fix (if authorized)

**Expected output:**
- Debug report with root cause analysis
- Suggested patches or workarounds
- Prevention recommendations

---

### git-manager
**Purpose:** Handle Git operations safely.

**Activation triggers:**
- Auto-invoked when `Task(..., git_manager.enabled=true)`
- `/git:*` commands (commit, create-pr, rebase, etc.)

**Responsibilities:**
- Stage appropriate files (respecting `.gitignore`)
- Create conventional commit messages (`feat:`, `fix:`, `docs:`, etc.)
- Create feature branches if needed
- Push and create PRs (if configured)
- Resolve merge conflicts (with user approval)

**Configuration:** `mekong.config.yaml → agents.git_manager.commit_style: conventional`

**Conventional Commits format:**
```
feat: add user registration JWT flow
fix: resolve checkout race condition
docs: update API reference for orders endpoint
refactor: extract payment middleware
test: add Playwright test for checkout flow
```

---

### docs-manager
**Purpose:** Create and maintain project documentation.

**Activation triggers:**
- `/ck:docs` command
- Documentation tasks in plans

**Responsibilities:**
- Execute doc creation phases from `planner` output
- Write clear, concise, well-structured markdown
- Follow `./docs/` standards and naming conventions
- Ensure cross-references between docs are valid
- Update docs/README.md navigation hub

**Expected output:**
- New/updated doc files in `/docs/`
- Prompt files in `prompts/`
- PR templates in `.github/`

**See:** `documentation-management.md` for detailed protocols.

---

### security-scan
**Purpose:** Security audit and vulnerability scanning.

**Activation triggers:**
- `/ck:security` command (full audit)
- `/ck:security-scan` command (quick scan)

**Responsibilities:**
- Scan for secrets (API keys, credentials) in code
- Check OWASP Top 10 patterns (XSS, CSRF, SQLi, etc.)
- Review CORS, rate limiting, authentication flows
- Generate security report with risk levels
- Recommend mitigations

**Expected output:**
- Security audit report
- Vulnerability list with severity (Critical/High/Medium/Low)
- Fix instructions

---

### project-manager
**Purpose:** Roadmap and task management.

**Activation triggers:**
- Roadmap planning sessions
- Task breakdown from `05_TASKS/` creation

**Responsibilities:**
- Define milestones and timeline
- Break down epics into user stories
- Prioritize tasks (P0/P1/P2)
- Track progress against roadmap
- Update `04_ROADMAP.md`

**Expected output:**
- `04_ROADMAP.md` with timeline
- `05_TASKS/` directory with task files per domain

---

### architect
**Purpose:** Architecture decision records and system design.

**Activation triggers:**
- Architecture phase in `planner` output
- Major design decisions requiring ADRs

**Responsibilities:**
- Evaluate architectural options (trade-offs analysis)
- Document decisions in ADR format (`06_ADR/NNNN-title.md`)
- Ensure consistency across system components
- Review technical feasibility

**Expected output:**
- `03_ARCHITECTURE.md` system overview
- `06_ADR/` directory with numbered ADRs

**ADR format:**
```markdown
# ADR NNN: Title
Date: YYYY-MM-DD
Status: Accepted/Deprecated/Experimental
Context: What problem needed decision?
Decision: What was chosen and why
Consequences: Positive/negative outcomes
Alternatives considered: Other options
Related: Links to code/docs
```

---

## Model Assignment

From `mekong.config.yaml → openclaw.model.routing`:

| Task Type | Primary Model | Fallback |
|-----------|---------------|----------|
| Complex refactor | `opencode-go/glm-5` | `opencode-go/qwen3.6-plus` |
| Code generation | `opencode-go/qwen3.6-plus` | `opencode-go/deepseek-v4-flash` |
| Debugging | `opencode-go/deepseek-v4-pro` | `opencode-go/deepseek-v4-flash` |
| Research | `opencode-go/minimax-m2.7` | `opencode-go/qwen3.6-plus` |
| Quick tasks | `opencode-go/deepseek-v4-flash` | — |

---

## Agent Invocation

### From CLI (slash commands)
```
/plan --ultracode build user auth
/cook --auto
/test
/review
/security
/docs
```

### From Code (Task tool)
```python
Task(
    description="Implement user authentication",
    prompt="...",
    subagent_type="fullstack-developer",
    model="claude-opus-4-8"  # optional override
)
```

### From Workflow (parallel)
```python
# Parallel execution with distinct file ownership
Task(..., subagent_type="fullstack-developer")  # frontend
Task(..., subagent_type="fullstack-developer")  # backend
Task(..., subagent_type="tester")              # tests
```

---

## Permissions

Each agent has default permissions configured in `.claude/settings.json` or `settings.local.json`. Common permissions:

- **Read access:** Entire project codebase
- **Write access:** Scope-limited to assigned files/directories
- **Shell access:** Restricted (only `npm`, `git`, `wrangler` commands)
- **Network access:** Allowed for API calls during research

**See:** `.claude/settings.json` for full permission matrix.

---

**Related:** `CLAUDE.md` (execution protocol), `primary-workflow.md` (agent orchestration patterns)
