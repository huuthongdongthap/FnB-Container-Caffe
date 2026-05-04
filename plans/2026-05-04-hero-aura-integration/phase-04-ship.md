# Phase 04 — Ship

## Goal

Final validation and report after all tweaks are committed and pushed.

## Slash commands to run

```
/qa-e2e hero-demo.html
/qa-perf hero-demo.html
/review hero-aura
```

## What each command does

- **`/qa-e2e`** — Re-run e2e to confirm tweaks didn't break anything.
- **`/qa-perf`** — Re-run Lighthouse to confirm Performance still ≥ 85.
- **`/review hero-aura`** — Code review of all changes since base commit `cb8cc3f`.

## Acceptance

- [ ] `/qa-e2e` passes
- [ ] `/qa-perf` Performance ≥ 85
- [ ] `/review` finds no blocking issues
- [ ] Git status clean

## On completion

Worker comments final report to issue #16:

```
## Phase 04 Final

- /qa-e2e: <PASS|FAIL>
- /qa-perf: <score>/100
- /review: <clean|N issues>

### Tweak commits
<git log --oneline since cb8cc3f>

Em đã xong, anh review nhé?
```

Then STOPS. Anh Thông decides whether to merge PR #1.
