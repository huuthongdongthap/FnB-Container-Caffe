# Code Review Prompt

**Purpose:** Comprehensive code review covering functionality, security, performance, and quality.

**Context:**
You are reviewing code changes for {PROJECT_NAME}. The changes affect: {AFFECTED_COMPONENTS}.

**Instructions:**

Perform a thorough code review using the checklist below. Provide specific, actionable feedback with file references.

---

## Review Checklist

### 1. Functionality
- [ ] Code meets the stated requirements
- [ ] Edge cases handled
- [ ] Error handling appropriate
- [ ] No obvious bugs (off-by-one, null derefs, etc.)
- [ ] Business logic correct

### 2. Security
- [ ] No hardcoded secrets/credentials
- [ ] Input validation present
- [ ] Authentication/authorization checked
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output encoding)
- [ ] CSRF protection
- [ ] Sensitive data not logged
- [ ] Dependency vulnerabilities checked (no known CVEs)

### 3. Performance
- [ ] No N+1 queries
- [ ] Caching strategy appropriate
- [ ] Efficient algorithms (no O(n²) where O(n) possible)
- [ ] Network requests minimized
- [ ] Assets optimized (no oversized images, etc.)

### 4. Code Quality
- [ ] Clear variable/function names
- [ ] Single responsibility per function
- [ ] DRY principle followed
- [ ] No code duplication
- [ ] Appropriate comments (explain why, not what)
- [ ] Consistent style with codebase
- [ ] No dead code or commented-out code

### 5. Testing
- [ ] Unit tests added (if applicable)
- [ ] Test coverage ≥ {COVERAGE_TARGET}%
- [ ] Tests are meaningful (not just coverage)
- [ ] Edge cases tested
- [ ] Mocking appropriate (not over-mocked)

### 6. Documentation
- [ ] README updated (if user-facing changes)
- [ ] API docs updated
- [ ] Inline documentation added for complex logic
- [ ] CHANGELOG updated

### 7. Migration/Deployment
- [ ] Database migrations reversible
- [ ] Backwards compatible (or documented breaking changes)
- [ ] Environment variables documented
- [ ] Rollback plan exists
- [ ] No data loss risk

---

## Output Format

```markdown
# Code Review: {PR_TITLE}

**Overall Assessment:** {APPROVED|CHANGES_REQUESTED|REJECTED}

## Summary
{BRIEF_SUMMARY}

## Issues Found

### Critical (Must Fix)
- [{SEVERITY}] {ISSUE_DESCRIPTION}
  - Location: {FILE}:{LINE}
  - Suggested fix: {FIX_SUGGESTION}

### Major (Should Fix)
- [{SEVERITY}] {ISSUE_DESCRIPTION}
  - Location: {FILE}:{LINE}
  - Suggested fix: {FIX_SUGGESTION}

### Minor (Optional)
- [{SEVERITY}] {ISSUE_DESCRIPTION}
  - Location: {FILE}:{LINE}
  - Suggested fix: {FIX_SUGGESTION}

## Positive Notes
- {POSITIVE_1}
- {POSITIVE_2}

## Questions
- {QUESTION_1} (needs clarification)
- {QUESTION_2}

---
**Reviewer:** {YOUR_NAME}
**Reviewed on:** {DATE}
**Recommendation:** {APPROVE|REQUEST_CHANGES|REJECT}
```

**Severity Levels:**
- **Critical:** Security vulnerability, data loss risk, blocking bug
- **Major:** Functional bug, performance issue, maintainability concern
- **Minor:** Style issue, nitpick, minor improvement
