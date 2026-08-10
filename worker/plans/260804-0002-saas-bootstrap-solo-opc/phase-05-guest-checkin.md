---
phase: 5
title: "Guest Check-In Rewards"
status: completed
priority: P1
effort: "2h"
dependencies: [2]
---

# Phase 5: Guest Check-In Rewards

## Context Links
- Reports: `reports/researcher-saas-scope.md` (F1)
- Existing: `src/routes/checkin.ts`

## Overview
Rewards flow already exists. Adjust for solo OPC context: no tenant isolation needed, single caffe.

## Requirements
- Guest enters name + phone → gets reward balance
- Duplicate-day guard already implemented
- Reuse existing checkin endpoint

## Architecture
Check-in endpoint already exists in `src/routes/checkin.ts`. No new code needed — validate flow works with single-tenant setup.

## Related Code Files
- Read: `src/routes/checkin.ts`

## Implementation Steps
1. Review checkin.ts for tenant isolation logic
2. Remove or bypass tenant check for single-tenant mode
3. Test check-in flow end-to-end

## Success Criteria
- [ ] Check-in returns reward balance
- [ ] Duplicate-day guard works
- [ ] No tenant errors in single-tenant mode

## Risk Assessment
- Low risk: mostly validation + testing

## Security Considerations
- Rate-limit check-in per phone number

## Next Steps
Unblocks: Phase 6
