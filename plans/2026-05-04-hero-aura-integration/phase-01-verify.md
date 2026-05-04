# Phase 01 — Verify

## Goal

Confirm hero-demo.html renders correctly on local Vite dev server with 0 console errors and meets visual + functional acceptance criteria.

## Slash commands to run (in order)

```
/qa-e2e hero-demo.html
/qa-perf hero-demo.html
```

## What each command does

- **`/qa-e2e hero-demo.html`** — Spins up Vite dev server, opens hero-demo.html in headless browser, runs e2e checks: page loads, no console errors, 4 ambient rings animate, click triggers ripple, logo hover triggers ripple. Reports pass/fail per check.
- **`/qa-perf hero-demo.html`** — Runs Lighthouse mobile perf audit. Must score ≥ 85 on Performance.

## Acceptance

- [ ] `/qa-e2e` exit code 0, all checks pass
- [ ] `/qa-perf` reports Performance ≥ 85
- [ ] No file modifications during this phase (read-only)

## On completion

Worker comments to issue #16 with:
- e2e results table
- Lighthouse score
- Question: "Anh Thông xem hero-demo có gì cần chỉnh không ạ?"

Then STOPS and waits for phase-02 trigger.

## On failure

- If `/qa-e2e` fails: do NOT proceed. Comment failure details to issue #16. Wait for instructions.
- If `/qa-perf` < 85: comment Lighthouse breakdown. Wait for instructions — do NOT auto-tweak.
