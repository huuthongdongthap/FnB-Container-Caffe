# Code Review Prompt

**Purpose:** Standardize code review process across the team.

## Instructions

When reviewing a PR or code change, check:

### 1. Functionality
- [ ] Code implements the stated goal/requirement?
- [ ] Edge cases handled?
- [ ] Error handling present?
- [ ] No console.log in production (except console.error)?

### 2. Security
- [ ] No secrets in code (API keys, passwords)
- [ ] Input validation on all user inputs
- [ ] SQL queries use parameterized statements (no concatenation)
- [ ] JWT verification on protected routes
- [ ] Rate limiting on sensitive endpoints
- [ ] CORS configured correctly
- [ ] No XSS vulnerabilities (no innerHTML with unsanitized data)

### 3. Performance
- [ ] No N+1 query problems
- [ ] Database queries use indexes where needed
- [ ] No unnecessary D1/KV reads
- [ ] Bundle size impact assessed (if frontend)
- [ ] No blocking operations in Worker (async/await used correctly)

### 4. Code Quality
- [ ] Follows project code standards (see `docs/code-standards.md`)
- [ ] Functions are small and focused (<50 LOC)
- [ ] Variables have meaningful names
- [ ] Comments explain "why", not "what"
- [ ] No duplicate code (DRY)
- [ ] ESLint passes (no errors)

### 5. Testing
- [ ] New code has corresponding tests
- [ ] Tests cover happy path and error cases
- [ ] Test coverage does not drop below 80%
- [ ] Tests are deterministic (no flaky tests)

### 6. Documentation
- [ ] README updated if new feature affects users
- [ ] API docs updated (if applicable)
- [ ] ADR created for architectural changes?
- [ ] CHANGELOG updated?

### 7. Backward Compatibility
- [ ] API changes are versioned or breaking changes documented
- [ ] Database migrations are reversible
- [ ] No breaking changes without deprecation period

## Review Checklist Format

When submitting review, use:

```
## Review: [PR title]

### ✅ Approved
- [x] Item 1
- [x] Item 2

### ⚠️ Changes Required
- [ ] Issue 1 — Suggestion
- [ ] Issue 2 — Suggestion

### ❌ Blocked
- [ ] Critical issue — Must fix before merge

### Questions
- Question for author?

**Verdict:** [APPROVE / REQUEST CHANGES / BLOCKED]
```

## Automated Checks (CI)

The following are enforced by CI:
- Linting (ESLint)
- Unit tests (Jest) with coverage ≥ 80%
- Build succeeds (Vite)
- No security vulnerabilities in dependencies (npm audit)

Do not merge if CI fails.

---

*This prompt is used by the `/ck:review` skill.*
