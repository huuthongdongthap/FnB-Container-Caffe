# Phase 03 — Tweak

## Goal

Apply anh Thông's feedback to the 3 hero files via Mekong CLI commands.

## Slash commands to run

For each atomic feedback item:

```
/frontend-ui-build hero-aura --tweak "<feedback item>"
/worker-commit hero "<what changed> per feedback"
```

After all tweaks done:

```
/worker-push
```

## What each command does

- **`/frontend-ui-build hero-aura --tweak "..."`** — DAG: `/component` (read existing) → `/cook --frontend` (apply tweak) → `/e2e-test` (verify nothing broke). Touches only files registered to the `hero-aura` component scope.
- **`/worker-commit hero "..."`** — git_manager agent: `git diff` review, stage only relevant files (never `git add -A`), conventional commit, verify no secrets.
- **`/worker-push`** — Push current branch to origin.

## Atomic-tweak rule

One feedback item = one `/frontend-ui-build` + one `/worker-commit` cycle. Do NOT batch multiple unrelated tweaks into one commit.

## Files in scope

Only:
- `css/hero-aura.css`
- `js/hero-aura.js`
- `hero-demo.html`

If feedback requires touching anything else: STOP, comment to issue #16, ask.

## Ambiguous feedback

If a feedback item is unclear (e.g. "đẹp hơn nữa", "sang trọng hơn"):
- Do NOT improvise.
- Comment a clarifying question to issue #16.
- Skip that item, proceed with the unambiguous ones.

## On completion

Proceed to phase-04-ship.
