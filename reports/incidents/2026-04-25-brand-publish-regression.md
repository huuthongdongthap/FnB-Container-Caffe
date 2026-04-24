# Incident Report: Brand Publish Regression

**Incident ID**: 2026-04-25-brand-publish-regression  
**Severity**: Low (Content Policy)  
**Status**: Investigating  
**Start Time**: 2026-04-25 00:35 UTC  

## Summary
Brand guideline migration to root exposed security gap: old docs/ path still accessible when it should return 404.

## Timeline
- 00:18 UTC: Deployed brand-guideline.html to root with /brand shortcut
- 00:24 UTC: Fixed redirect loop in _redirects  
- 00:35 UTC: QA brand check detected docs/brand-guideline.html still returns 200 (expected 404)

## Impact
- Blast radius: Content policy violation
- Customer impact: None (functional site working)
- Risk: Duplicate content accessible via old path

## Root Cause
Cloudflare Pages retains deployed content even after git file removal. .cfignore or explicit removal needed.

## Mitigation Plan
1. Check .cfignore configuration
2. Explicit docs/ directory blocking
3. Force Pages redeploy with clean state

## Action Items
- [ ] Review .cfignore rules for docs/ exclusion
- [ ] Test docs/ blocking post-mitigation  
- [ ] Update deploy process to handle file removals