## Description

[Provide a brief description of the changes and the problem they solve]

## Related Issues

[Link to any related issues, e.g., Fixes #123]

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update
- [ ] 🧹 Code cleanup (no functional changes)

## Changes Made

- [ ] List the key changes made in this PR
- [ ] Include any new files, renamed files, or deleted files

## Testing

- [ ] Unit tests added/updated and passing (`npm test`)
- [ ] Integration tests passing (`npm run test:ci`)
- [ ] Manual testing performed (describe what was tested)
- [ ] Build succeeds (`npm run build`)
- [ ] No console.log in production code (except console.error)

### Test Coverage

- [ ] Coverage did not decrease (target ≥80%)
- [ ] New code covered by tests

## Documentation

- [ ] README updated (if user-facing changes)
- [ ] CHANGELOG.md updated (if this affects users)
- [ ] API documentation updated (docs/03_ARCHITECTURE.md)
- [ ] ADR created for architectural changes (docs/06_ADR/)
- [ ] Related task updated in docs/05_TASKS/

## Security Review

- [ ] No secrets added (check for API keys, passwords)
- [ ] Input validation added for new user inputs
- [ ] Rate limiting considered (if new public endpoint)
- [ ] SQL queries use parameterized statements (no concatenation)
- [ ] JWT/auth checks on protected routes

## Performance Impact

- [ ] No significant performance regression
- [ ] If adding D1 queries, added indexes where needed
- [ ] Bundle size impact assessed (frontend changes only)

## Deployment Notes

- [ ] No database migration needed / Migration included and tested
- [ ] No environment variable changes required / Variables documented
- [ ] No manual steps required post-deploy / Steps listed below

### Manual Steps (if any)

1. Step one
2. Step two

## Checklist Before Merging

- [ ] All CI checks passing (lint, test, build)
- [ ] Code reviewed by at least one team member
- [ ] No merge conflicts with main branch
- [ ] All review feedback addressed

---

**Reviewer Assignees:** @owner @backend-lead  
**Priority:** Low / Medium / High

**Note:** Merge only after all checkboxes are checked and approvals received.
