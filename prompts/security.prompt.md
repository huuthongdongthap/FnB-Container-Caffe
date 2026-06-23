# Security Audit Prompt

**Purpose:** Conduct security review of code, configuration, and deployment.

## Instructions

Perform a STRIDE threat model and OWASP Top 10 check:

### STRIDE by Layer

| Threat | Spoofing | Tampering | Repudiation | Information Disclosure | Denial of Service | Elevation of Privilege |
|---------|----------|-----------|-------------|------------------------|-------------------|------------------------|
| **Frontend** | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ❌ |
| **API** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Database** | N/A | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| **Infrastructure** | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ |

**Key:** ✅ Mitigated | ⚠️ Needs review | ❌ Unmitigated

### OWASP Top 10 Check

1. **Broken Access Control**
   - [ ] All protected routes require authentication
   - [ ] Authorization checks use role/permissions
   - [ ] No direct object reference vulnerabilities (e.g., `/api/orders/:id` checks ownership)

2. **Cryptographic Failures**
   - [ ] Secrets stored in Cloudflare secrets (not in code)
   - [ ] HTTPS enforced (Pages auto-enforces)
   - [ ] JWT signed with strong secret (256-bit)
   - [ ] No sensitive data in logs

3. **Injection**
   - [ ] All D1 queries use parameterized statements
   - [ ] No string concatenation in SQL
   - [ ] Input validation on all user inputs (phone, email)

4. **Insecure Design**
   - [ ] Rate limiting prevents abuse
   - [ ] Audit logging for accountability
   - [ ] Fail-secure defaults (deny-by-default)

5. **Security Misconfiguration**
   - [ ] CORS allowlist restricts origins
   - [ ] Cloudflare security headers enabled (CSP, HSTS)
   - [ ] No debug mode in production

6. **Vulnerable Components**
   - [ ] Dependencies scanned (`npm audit`)
   - [ ] No known CVEs in package-lock.json
   - [ ] Regular dependency updates (weekly)

7. **Identification & Authentication**
   - [ ] JWT expiry set (7 days)
   - [ ] Weak password check during registration
   - [ ] Brute force protection (rate limiting)
   - [ ] Consider MFA for admin accounts

8. **Software & Data Integrity**
   - [ ] Code signing (Git commits signed)
   - [ ] CI/CD pipeline secured (no secret leakage)
   - [ ] Wrangler deploy uses API token (not local secrets)

9. **Security Logging & Monitoring**
   - [ ] Audit logs written for sensitive actions
   - [ ] Error messages don't leak implementation details
   - [ ] Failed auth attempts logged
   - [ ] Alert on unusual activity (e.g., 100+ failed logins/min)

10. **Server-Side Request Forgery (SSRF)**
    - [ ] No server makes requests to user-controlled URLs
    - [ ] If outbound HTTP needed, use allowlist

### Configuration Checks

**Cloudflare:**
- [ ] Secrets configured via Dashboard (not wrangler secret in .env)
- [ ] Pages access restrictions (if needed)
- [ ] Worker routes protected by firewall rules (optional)

**Database:**
- [ ] No default credentials (D1 auto-generated)
- [ ] Backups enabled (daily)
- [ ] Restore tested quarterly

### Compliance

**Vietnam E-invoicing:**
- [ ] E-invoice generation implemented (Odoo planned)
- [ ] Invoice data stored securely
- [ ] Retention period meets legal requirements (10 years)

**Data Privacy (GDPR-ish):**
- [ ] Customer data can be deleted (right to be forgotten)
- [ ] Data minimization — only collect necessary fields
- [ ] Privacy policy accessible on website

## Security Report Format

```markdown
# Security Audit: [Feature/PR]

**Date:** YYYY-MM-DD
**Auditor:** [Name]
**Scope:** [Files reviewed]

## Findings

### 🔴 Critical
None.

### 🟡 Medium
1. [Finding title]
   - **Location:** `file:line`
   - **Description:** What's wrong
   - **Impact:** Potential damage
   - **Recommendation:** Fix suggestion
   - **Status:** Open

### 🟢 Low
- [Minor finding]

## Summary
- Total issues: X
- Action required: [YES/NO]
```

## Remediation

1. Critical issues → Fix immediately, block merge
2. Medium issues → Fix within 48h, require review
3. Low issues → Track in backlog, optional

---

*This prompt is used by the `/ck:security-scan` skill.*
