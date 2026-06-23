# ADR 002: Choose D1 SQLite Over PostgreSQL

**Date:** 2026-03-10  
**Status:** Accepted  
**Decision Maker:** CTO

## Context

We needed a database for:
- Storing orders, customers, menu, reservations
- Expected size: < 100K rows total, < 500MB data
- Need simple queries, ACID transactions, foreign keys
- Must integrate with Cloudflare Workers

Alternatives:
1. **Cloudflare D1 (SQLite)**: Free 5GB, built-in backup, simple
2. **Cloudflare D1 External (PostgreSQL)**: Connect to external Postgres, $5/mo
3. **Supabase Postgres**: Managed, $25/mo minimum
4. **Self-hosted Postgres on VPS**: Complex, needs maintenance

## Decision

Chose **Cloudflare D1 (SQLite)** for zero cost and simplicity.

## Consequences

### Positive
- ✅ Free (within Cloudflare Free Tier)
- ✅ Simple schema, easy to understand
- ✅ Automatic daily backups
- ✅ No connection pool management (Workers handles)
- ✅ Sufficient for our query patterns (no complex joins)

### Negative
- ⚠️ SQLite limitations:
  - No stored procedures
  - Limited ALTER TABLE capabilities
  - No partial indexes (but we don't need them)
  - Concurrent writes serialized (but our write volume is low ~100/day)
- ⚠️ No full-text search (but we can add with LIKE or external search later)
- ⚠️ No JSONB type (but we use JSON strings in TEXT fields)

### Risks
- **Schema migrations**: SQLite ALTER TABLE is limited; we use create-new-table + copy pattern (see migrations/)
- **Concurrent writes**: SQLite uses file locks, but D1 handles this at service layer; contention unlikely at our volume
- **Future scaling**: If we grow to 10x volume, may need to migrate to Postgres — but data export is straightforward

## Mitigations
- Keep migrations versioned and tested
- Use transactions for all writes
- Monitor D1 storage usage (Cloudflare dashboard)
- Plan migration path to Postgres if needed (same SQL dialect mostly)

## Alternatives Considered (Rejected)

- **PostgreSQL via Supabase**: Overkill, costs $25/mo for our needs
- **PlanetScale MySQL**: Good but external dependency, costs
- **MongoDB Atlas**: NoSQL not a good fit for relational data (orders, items, customers)

## Related

- Database schema: `db/schema.sql`
- Migrations: `db/migrations/`
- Usage in code: `worker/src/lib/db.js`
