# ADR 008: Audit Logging to Git-Tracked JSON Files

**Date:** 2026-03-15  
**Status:** Accepted  
**Decision Maker:** Security Engineer / Founder

## Context

We needed an audit trail for:
- Compliance (track who did what)
- Debugging (trace issues)
- Accountability (staff actions)

Requirements:
- Immutable logs (cannot be tampered)
- Searchable
- Low cost (free tier friendly)
- Simple implementation

Alternatives:
1. **Git-tracked JSON files** (in `state/gates/`) — each action as file
2. **D1 audit table**: Centralized queryable table
3. **Cloudflare Logpush**: Push to external storage (S3, R2)
4. **No audit logging**: Accept risk of untraceable actions

## Decision

Chose **Git-tracked JSON files** in `state/gates/audit-*.json`.

## Consequences

### Positive
- ✅ **Immutable**: Git history ensures logs cannot be altered without detection
- ✅ **Free**: No storage cost (just included in repo)
- ✅ **Simple**: Write JSON file per audit event
- ✅ **Searchable**: `git log -S`, `grep` across history
- ✅ **Backup**: Git remote acts as backup

### Negative
- ⚠️ **Repository bloat**: Many logs increase repo size over time
  - Mitigation: Archive old logs to separate branch or R2 monthly
- ⚠️ **Query difficulty**: No SQL queries; must use grep/file scan
- ⚠️ **Write conflicts**: Concurrent Workers writing same directory could conflict (but filename includes timestamp + random, low collision)
- ⚠️ **Git deploy cycles**: Logs committed via Wrangler file system API, not actual git commits — but still persisted

### Risks
- **Log tampering**: If attacker gains write access to KV/D1, could delete/modify log files
  - Mitigation: Immutable backups, restricted access, separate audit-only permissions
- **Performance**: Writing file per audit event adds latency (~5-10ms)
  - Mitigation: Async write (not awaited) in middleware
- **Storage quota**: D1/KV storage limits — but JSON files are small (few KB each)

## Implementation

```javascript
// In middleware
export async function audit(action) {
  const log = {
    timestamp: new Date().toISOString(),
    user: ctx.state.user?.id || null,
    ip: ctx.req.headers.get('CF-Connecting-IP'),
    action,
    method: ctx.req.method,
    path: ctx.req.url,
    body: snapshot // trimmed
  };
  const filename = `state/gates/audit-${Date.now()}-${random(1000,9999)}.json`;
  await env.AUDIT_KV.put(filename, JSON.stringify(log)); // or D1
}
```

## Alternatives Considered (Rejected)

- **D1 audit table**: Would fill up quickly, requires cleanup job; queries easier but costs ops
- **Cloudflare Logpush**: Requires paid plan, external storage costs
- **Sentry**: Too expensive, not audit-focused

## Future Evolution

If audit volume grows:
1. Rotate logs: `state/gates/audit-2026-06/` monthly directories
2. Compress old logs with gzip
3. Implement log aggregation script to extract to D1 for reporting
4. Consider Cloudflare R2 for archival (cheap object storage)

## Related

- Audit middleware: `worker/src/middleware/audit.js`
- Log storage: `state/gates/` (git-ignored in `.gitignore`, but deployed artifact)
- CEO-HANDOVER.md section on audit trail usage
