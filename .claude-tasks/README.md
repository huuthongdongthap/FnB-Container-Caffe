# Claude Code CLI Task Files

This directory contains pre-written task instructions for Claude Code CLI workers.

## Why task files?

Sending long multi-line tasks via `tmux send-keys -l` is fragile:
- Vietnamese characters may be mis-encoded
- Long content may be truncated
- Multiline content can confuse the terminal buffer

Instead, the dispatcher writes a tiny ASCII command like:

```
Read .claude-tasks/hero-phase-2.md and execute it strictly.
```

The worker reads the markdown file from disk and gets the full context locally.

## Files

- `hero-phase-1.md` — Smoke test only
- `hero-phase-2.md` — Smoke test + report (default entry point)
- `hero-phase-3.md` — Apply user feedback (FEEDBACK injected by dispatcher)
- `hero-phase-4.md` — Final validation

## Lifecycle

These files are part of the repo and tracked in git so workers across panes can read them. They are NOT regenerated per run — only `hero-phase-3.md` is rewritten by the dispatcher when FEEDBACK changes.
