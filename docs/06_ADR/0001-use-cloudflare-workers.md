# ADR 001: Use Cloudflare Workers as Backend Platform

**Date:** 2026-03-10  
**Status:** Accepted  
**Decision Maker:** CTO / Founder

## Context

We needed a backend platform for F&B Container Caffe that would:
- Support expected load (~500 customers/day, ~1000 requests/day)
- Cost ≤ 700,000 VND/month (~$30 USD)
- Scale automatically without server management
- Provide global CDN edge distribution
- Support serverless functions with database access

Alternatives considered:
1. **Traditional VPS** (DigitalOcean, Linode): $10-20/mo + manual scaling
2. **AWS Lambda / GCP Cloud Functions**: Pay-per-use but complex deployment
3. **Vercel / Netlify Functions**: Limited to static sites, less flexible
4. **Self-hosted on-premise server**: High upfront cost, maintenance burden

## Decision

Chose **Cloudflare Workers** with:
- Free Tier: 100,000 requests/day
- D1 SQLite database (5GB free)
- KV namespace for session storage
- Global edge network (low latency)

## Consequences

### Positive
- ✅ Zero server management
- ✅ Automatic scaling
- ✅ Sub-millisecond latency at edge
- ✅ Free tier sufficient for single-location cafe
- ✅ Integrated with Cloudflare Pages (same account)
- ✅ Built-in DDoS protection

### Negative
- ⚠️ D1 is SQLite (no PostgreSQL features like JSONB, full-text search)
- ⚠️ KV is key-value only (no secondary indexes)
- ⚠️ Worker CPU time limit (10ms per request typical, 50ms max)
- ⚠️ Debugging distributed functions can be harder than monolith

### Risks
- **Free Tier limits**: If usage exceeds 100k requests/day, need $5/mo plan (still cheap)
- **Vendor lock-in**: Cloudflare-specific APIs (Wrangler, D1) — migration to other serverless would require refactoring
- **Cold starts**: Minimal on Workers (instant) but D1 connection pool reuse matters

## Alternatives Considered (Rejected)

- **VPS**: Too much operational overhead for small team
- **AWS Lambda**: More expensive at our scale, steeper learning curve
- **Supabase**: Would cost ~$25/mo minimum, still need to manage Postgres

## Related

- See `deployment.md` for deployment configuration
- See `worker/wrangler.toml` for actual bindings
- See `CEO-HANDOVER.md` section 14 for Free Tier limits monitoring
