# Mixpost Social Media Bridge: 3 Critical Bugs Found and Fixed

**Date**: 2026-07-01 01:17
**Severity**: Critical
**Component**: Mixpost Social Media Bridge (Phase 04 finalize)
**Status**: Resolved (commit f07d763)

## What Happened

The code-reviewer agent flagged 3 critical and 2 high-severity bugs in the Mixpost bridge implementation during Phase 04 final review. All five were fixed in a single commit. All three cron functions for auto-posting to social media would have been dead code in production. Any post with images would have posted without media. And the setup guide would have pointed operators at a doubled URL path that silently failed.

## The Brutal Truth

This is embarrassing. The cron functions (autoPostDailySpecials, autoPostNewPromotions, autoPostWeeklyHighlights) were sitting in `routes/mixpost.js`, fully implemented, exporting properly -- and nobody wired them into the scheduled handler. The import line was simply missing from `index.js`. A developer that reads the file top-to-bottom in one sitting catches this. We didn't. That means someone (me) reviewed the cron functions in isolation but never looked at where they get called. Classic local-optimization blind spot.

The media ID bug is worse. `uploadMediaFromUrl` returned IDs correctly. Those IDs were collected in the route handler. And then `createPost` was called without them -- the media field was hardcoded to an empty array `[]` in the payload. The `mediaIds` parameter existed in the route but was never destructured or plumbed through. This means every promotional post with an image would have published as text-only. The cafe posts "Giam 20% hom nay!" with a beautiful banner photo that never shows up. The operator sees "Posted successfully" and never knows.

The setup guide URL was just carelessness. MIXPOST_API_URL had "/api/mixpost" on the end, but the client code already appends "/api/mixpost/posts" to whatever base is configured. Result: requests go to `/api/mixpost/api/mixpost/posts`. Any new operator following the guide would configure this wrong, debug for an hour, and give up.

## Technical Details

**C1 -- Unwired cron handlers (CRITICAL)**
- Files: `worker/src/index.js`, `worker/src/routes/mixpost.js`
- Scheduled handler had imports for ERPNext, Mautic, ZNS, and Cal cron jobs but no import for mixpost handlers
- Fix: added import line for `mixpostRouter, autoPostDailySpecials, autoPostNewPromotions, autoPostWeeklyHighlights`, then added three `ctx.waitUntil(...)` calls in the exported `scheduled` handler
- Each cron would have silently compiled to a no-op in production on the CRON trigger

**C2 -- Missing media IDs in createPost payload (CRITICAL)**
- File: `worker/src/lib/mixpost-client.js`
- `createPost` signature had no `mediaIds` parameter; payload had `media: []`
- Fix: added `mediaIds` to destructured params, mapped to `media: (mediaIds || []).map(id => ({ id }))` inside `versions[0].content[0]`
- Route handler was already calling `uploadMediaFromUrl` and collecting IDs -- the gap was at the function boundary

**C3 -- Doubled API path in setup guide (CRITICAL)**
- File: `docs/mixpost-setup-guide.md`
- Example value showed `MIXPOST_API_URL = "http://YOUR_SERVER_IP:9000/api/mixpost"`
- Client already builds paths like `${baseUrl}/api/mixpost/posts`
- Fix: changed to `MIXPOST_API_URL = "http://YOUR_SERVER_IP:9000"` (base only)

**H1 -- console.warn in production (HIGH)**
- `worker/src/routes/mixpost.js` had a `console.warn` for 401 responses
- Replaced with `log.warn()` using the structured logger imported at the top

**H2 -- No empty accounts guard (HIGH)**
- All three cron functions would attempt to post when `MIXPOST_ACCOUNTS` env var was empty/unset
- Fix: early-return guard at the top of each function

## What We Tried

No failed fixes -- the code-reviewer flagged these during review before any production deployment occurred. The fixes were applied and verified directly.

## Root Cause Analysis

Three distinct failure modes converged:

1. **Review scope isolation**. The cron functions were reviewed as a unit within `mixpost.js`. The scheduled handler in `index.js` was never re-examined after the mixpost code was added. Code review must verify the entire call chain, not just the implementation.

2. **Parameter plumbing gap**. `mediaIds` was collected in the route handler and passed to `createPost` on the object -- but the destructuring in `createPost` didn't list it. TypeScript would have caught this. We chose vanilla JS for the worker. This is the cost of that tradeoff.

3. **Documentation drift**. The setup guide was written before the client implementation was finalized. The URL suffix was included because it "seemed right" at the time. Documentation must be validated against the actual code path, not written from assumption.

## Lessons Learned

- Scheduled handler imports should have a checklist: every cron file imported must appear in at least one `ctx.waitUntil` call in the same file. This is a grep-able invariant.
- Vanilla JS functions that accept objects should type-check their inputs at the boundary. A runtime assertion (`if (!mediaIds) log.warn(...)`) would have caught the media ID gap in testing.
- Setup guide values must be validated against the actual code. Run the curl command shown in the docs and verify the response before committing.
- Code review must trace the full execution path. Reviewing a module in isolation misses integration bugs. A "call chain review" pass should be a standard step for any new platform integration.

## Next Steps

- None -- all fixes are committed (f07d763), 789/789 tests pass, build is clean.
- Future guard: add a scheduled handler checklist to the Phase 04 close-out procedure to verify every cron import has a corresponding `ctx.waitUntil` call.
