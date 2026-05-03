# Phase 1 — Smoke Test

**Read this entire file before doing anything.**

Follow `CLAUDE.md` execution protocol: no greetings, no explanations, terse output.

## Steps

1. Verify you are in the repo root: `pwd` must end with `/FnB-Container-Caffe`
2. Verify branch: `git branch --show-current` must print `claude/focused-tharp`
3. Verify the 3 hero files exist:
   ```bash
   ls -la css/hero-aura.css js/hero-aura.js hero-demo.html
   ```
4. Read `plans/hero-aura-integration.md` section "Pre-flight Checks" and "TASK 1"
5. Start Vite dev server in background:
   ```bash
   npm run dev --silent &
   sleep 5
   ```
6. Curl the hero demo to verify it serves:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/hero-demo.html
   ```
   (Adjust port if vite.config.js uses different port. Read `vite.config.js` to confirm.)

## Report Format

Print exactly this, filling in real values:

```
[PHASE 1 SMOKE TEST]
- pwd: <output>
- branch: <output>
- files: <ok|missing>
- vite_port: <number>
- http_status: <code>
- result: <PASS|FAIL>
```

## Hard Rules

- Do NOT open browser, do NOT take screenshots in this phase.
- Do NOT modify any file.
- Do NOT proceed to phase 2 — stop and wait.
- If any step fails: stop, print the error, ask user.
