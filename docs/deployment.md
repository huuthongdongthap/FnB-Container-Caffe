# Deployment

## Platform: Cloudflare Workers
## URL: https://aura-space-worker.agencyos-openclaw.workers.dev
## Worker Name: aura-space-worker
## Version ID: e29565e6-a338-463b-b56e-e5bb3bda1e10
## Deployed: 2026-06-06

## Deploy Command
```bash
cd /Users/macbook/FnB-Container-Caffe/worker && npx wrangler deploy
```

## Bindings
- **D1 Database**: fnb-caffe-db (id: 13260741-7795-431f-b491-7c8a17510bda)
- **KV Namespace**: AUTH_KV (id: 5628adf57f1548b5af615de4e9021893)
- **Cron Trigger**: every 5 minutes (*/5 * * * *)

## Environment Variables
- ENVIRONMENT = production
- CORS_ORIGIN = *
- JWT_EXPIRY_SECONDS = 604800
- SLA_THRESHOLD_MINUTES = 15

## Secrets (set via CLI)
```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put PAYOS_CLIENT_ID
npx wrangler secret put PAYOS_API_KEY
npx wrangler secret put PAYOS_CHECKSUM_KEY
```

## Database Migrations
```bash
cd worker && npx wrangler d1 execute fnb-caffe-db --file=../db/migrations/YYYYMMDD_NN_description.sql
```

## Notes
- KV namespace was corrected from `789e7cf1894e4d4c9e8f8cd51b2dbe16` → `5628adf57f1548b5af615de4e9021893`
- Proxy vars must be unset before deploy: `unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy`
- Worker responds to `/api/health` with 200
