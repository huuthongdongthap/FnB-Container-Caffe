# Phase 02 — Feedback (manual gate)

## Goal

Wait for anh Thông to comment feedback on issue #16. No automated work in this phase.

## Trigger to next phase

Anh Thông comments on issue #16 with concrete feedback, e.g.:

> "Ripple chậm hơn 9s, tăng particles lên 30, đổi tagline thành 'Where Mekong meets craft coffee'"

When feedback arrives, anh Thông (or a dispatcher) tells the worker to proceed to phase-03 by running:

```
/plan fast "Apply feedback from issue #16 to hero-aura via plans/2026-05-04-hero-aura-integration/phase-03-tweak.md"
```

## Worker behavior during this phase

- IDLE. Do not poll. Do not assume feedback.
- If asked "are you done?" — respond `WAITING_FOR_FEEDBACK_PHASE_02`.
