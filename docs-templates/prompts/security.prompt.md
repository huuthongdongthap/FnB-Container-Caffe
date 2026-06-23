# Security Audit Prompt

**Purpose:** Perform comprehensive security audit using STRIDE and OWASP Top 10 frameworks.

**Context:**
You are conducting a security audit of {PROJECT_NAME}, a {BUSINESS_DOMAIN} system. The system handles: {DATA_TYPES}.

**Instructions:**

Perform a systematic security review covering:

## 1. STRIDE Threat Model

For each threat category, identify potential vulnerabilities:

| Threat | What to Look For | Findings |
|--------|------------------|----------|
| **S**poofing | Authentication bypass, fake identities | {FINDINGS_SPOOFING} |
| **T**ampering | Data modification, integrity violations | {FINDINGS_TAMPERING} |
| **R**epudiation | Actions can't be traced, no audit logs | {FINDINGS_REPUDIATION} |
| **I**nformation Disclosure | Data leaks, excessive data exposure | {FINDINGS_DISCLOSURE} |
| **D**enial of Service | Resource exhaustion, crash vulnerabilities | {FINDINGS_DOS} |
| **E**levation of Privilege | Unauthorized access to privileged functions | {FINDINGS_EOP} |

## 2. OWASP Top 10 (2021)

Review each category:

1. **Broken Access Control**
   - Authorization checks on every request
   - Principle of least privilege
   - No horizontal privilege escalation

2. **Cryptographic Failures**
   - TLS/SSL configuration
   - Secrets not in code
   - Proper hashing (bcrypt/argon2 for passwords)
   - Encryption at rest for sensitive data

3. **Injection**
   - SQL injection prevention (parameterized queries)
   - NoSQL injection prevention
   - Command injection prevention
   - XSS prevention (output encoding)

4. **Insecure Design**
   - Threat modeling evidence
   - Security requirements defined
   - Defense in depth

5. **Security Misconfiguration**
   - Default credentials changed
   - Unnecessary features disabled
   - Error messages don't leak info
   - HTTP security headers set

6. **Vulnerable and Outdated Components**
   - Dependency scan results
   - No known CVEs in dependencies
   - Regular updates schedule

7. **Identification and Authentication Failures**
   - Strong password policy
   - Multi-factor authentication available
   - Session management secure
   - Credential stuffing protections

8. **Software and Data Integrity Failures**
   - Supply chain security (signed packages)
   - CI/CD pipeline security
   - No unsigned code execution

9. **Security Logging and Monitoring Failures**
   - Audit logs for security events
   - Log integrity protection
   - Alerting on suspicious activity
   - Retention policy

10. **Server-Side Request Forgery (SSRF)**
    - Outbound request validation
    - URL whitelisting
    - No unrestricted external calls

## 3. Compliance & Privacy

- **Data Protection:** GDPR, CCPA compliance (as applicable)
- **PII Handling:** Minimization, retention, deletion
- **Consent Management:** User consent for data collection
- **Right to be Forgotten:** Deletion process exists

---

## Output Format

```markdown
# Security Audit: {PROJECT_NAME}

**Audit Date:** {DATE}
**Auditor:** {YOUR_NAME}
**Overall Risk Level:** {LOW|MEDIUM|HIGH|CRITICAL}

## Executive Summary
{BRIEF_SUMMARY_OF_FINDINGS}

## Findings

### Critical
- [{CVE_ID if applicable}] {FINDING_TITLE}
  - Category: {CATEGORY}
  - Description: {DESCRIPTION}
  - Impact: {IMPACT}
  - Likelihood: {LIKELIHOOD}
  - Recommended fix: {RECOMMENDATION}
  - Priority: {PRIORITY}

### High
...

### Medium
...

### Low
...

## Positive Security Practices
- {POSITIVE_1}
- {POSITIVE_2}

## Security Recommendations (Prioritized)

1. {RECOMMENDATION_1} (Address within {TIMEFRAME_1})
2. {RECOMMENDATION_2} (Address within {TIMEFRAME_2})
3. ...

## Follow-up
- Re-audit scheduled: {DATE}
- Security metrics to track: {METRICS_TO_TRACK}
```

**Notes:**
- Be specific: cite exact files and line numbers
- Prioritize: Critical → High → Medium → Low
- Provide actionable recommendations, not just problems
- Consider business context: some risks may be acceptable
- Suggest quick wins alongside fundamental fixes
