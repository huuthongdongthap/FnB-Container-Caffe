# Phase 2 — Smoke Test + Report

**Read this entire file before doing anything.**

Follow `CLAUDE.md` execution protocol: no greetings, no explanations, terse output.

## Steps

1. Run all of Phase 1 first (see `.claude-tasks/hero-phase-1.md`).
2. Read `plans/hero-aura-integration.md` sections "Acceptance Criteria" (Visual + Functional only).
3. For each Visual + Functional criterion, mark ✅ or ❌ based on what you can verify via:
   - Reading the source files (`hero-demo.html`, `css/hero-aura.css`, `js/hero-aura.js`)
   - Static analysis (no browser needed for most items)
4. For criteria that require visual inspection (e.g. animation smoothness), mark `❓ needs human review`.

## Comment to GitHub Issue #16

Use `gh` CLI to post a comment to issue #16:

```bash
gh issue comment 16 --repo huuthongdongthap/FnB-Container-Caffe --body "$(cat <<'EOF'
## 🔍 Phase 2 Smoke Test Report

### Pre-flight
- pwd: <fill>
- branch: <fill>
- files: <ok|missing>
- vite_port: <fill>
- http_status: <fill>

### Acceptance — Visual
- [ ] Background pure black + radial gold glow: <✅|❌|❓>
- [ ] Logo SVG renders: <✅|❌|❓>
- [ ] 4 ambient ripple rings: <✅|❌|❓>
- [ ] 3 water-line waves: <✅|❌|❓>
- [ ] ~18 particles: <✅|❌|❓>
- [ ] Custom cursor (desktop): <✅|❌|❓>
- [ ] Title "Where silence meets the aroma": <✅|❌|❓>
- [ ] 2 CTA buttons: <✅|❌|❓>

### Acceptance — Functional
- [ ] Click ripple: <✅|❌|❓>
- [ ] Logo hover ripple: <✅|❌|❓>
- [ ] Console: 0 errors: <✅|❌|❓>
- [ ] Responsive < 768px: <✅|❌|❓>

### Question for anh Thông
Anh xem hero-demo có gì cần chỉnh không ạ?
URL: http://localhost:8082/hero-demo.html
EOF
)"
```

## Hard Rules

- Do NOT modify any file in this phase.
- Do NOT proceed to phase 3.
- After posting the comment, print `[PHASE 2 DONE]` and stop.
- If `gh` is not installed: print the comment body to stdout instead and tell user to paste it manually.
