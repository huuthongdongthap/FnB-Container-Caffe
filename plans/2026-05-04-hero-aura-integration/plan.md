# 2026-05-04 — Hero AURA Integration

> **Convention**: this plan follows [`MEKONG_CLI_CONVENTIONS.md`](../../MEKONG_CLI_CONVENTIONS.md). All work is dispatched as Mekong CLI slash commands.
>
> **Branch**: `claude/focused-tharp` (PR #1)
> **Base commit**: [`cb8cc3f`](https://github.com/huuthongdongthap/FnB-Container-Caffe/commit/cb8cc3f00a7fcd81369606cee2c06666746978cf)
> **Issue**: [#16](https://github.com/huuthongdongthap/FnB-Container-Caffe/issues/16)

---

## Mission

Verify hero-aura section (`css/hero-aura.css`, `js/hero-aura.js`, `hero-demo.html`) runs locally on Vite, then tweak design based on anh Thông's feedback. All steps run as Mekong CLI slash commands — no custom bash scripts.

## Phases

```
phase-01-verify    → /qa-e2e + /qa-perf on hero-demo.html
phase-02-feedback  → wait for anh Thông (manual)
phase-03-tweak     → /frontend-ui-build hero-aura with feedback
phase-04-ship      → /worker-commit + /worker-push
```

## Out of scope

- DO NOT modify `index.html` (51KB, untouched).
- DO NOT modify any CSS/JS file other than `css/hero-aura.css`, `js/hero-aura.js`, `hero-demo.html`.
- DO NOT install npm packages.
- DO NOT migrate to React/Vue.
- DO NOT merge PR #1 — anh Thông decides.

## Success criteria

- `hero-demo.html` loads at `http://localhost:8082/hero-demo.html` with 0 console errors.
- 4 ambient ripple rings + 3 water-line waves + ~18 particles all animate smoothly.
- Click anywhere triggers gold ripple. Hover on logo triggers ripple every 700ms.
- Lighthouse Performance ≥ 85 (mobile).
- After tweaks: every feedback item from anh Thông is addressed in a separate commit.

## How to dispatch

```bash
# In tmux pane running Claude Code CLI inside ~/mekong-cli/FnB-Container-Caffe:
/plan fast "Read plans/2026-05-04-hero-aura-integration/plan.md and execute phases"
```

The worker will then run each phase's slash command in order. Phase 02 pauses for human feedback.
