# Phase 4 — Final Validation

**Read this entire file before doing anything.**

Follow `CLAUDE.md` execution protocol.

## Steps

1. ESLint:
   ```bash
   npx --silent eslint js/hero-aura.js 2>&1 | tail -20
   ```
   Must exit 0 with no warnings.

2. Lighthouse (mobile, performance only):
   ```bash
   npx --silent lighthouse http://localhost:8082/hero-demo.html \
     --only-categories=performance \
     --form-factor=mobile \
     --quiet \
     --output=json \
     --output-path=/tmp/lh-hero.json \
     --chrome-flags="--headless" 2>&1 | tail -5

   node -e "const r=require('/tmp/lh-hero.json'); console.log('Performance:', Math.round(r.categories.performance.score*100));"
   ```

3. Git status check:
   ```bash
   git status --short
   git log --oneline -10
   ```

## Comment to GitHub Issue #16

```bash
gh issue comment 16 --repo huuthongdongthap/FnB-Container-Caffe --body "$(cat <<EOF
## ✅ Phase 4 Final Validation

- ESLint: <PASS|FAIL>
- Lighthouse Performance: <number>/100
- Console errors: <count>
- Git status: <clean|dirty>

### Tweak commits
\`\`\`
<paste git log --oneline -10 output>
\`\`\`

Em đã xong, anh review nhé?
EOF
)"
```

## Hard Rules

- Do NOT modify any file.
- Do NOT close the issue — anh Thông will review and close.
- Print `[PHASE 4 DONE]` and stop.
