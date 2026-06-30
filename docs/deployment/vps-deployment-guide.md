# Aura Cafe — VPS Deployment Checklist / Danh Sach Triển Khai VPS
# Last updated: 2026-07-01

## Dịch vụ đa cai / Services Deployed

| Service | Port | Domain | Compose File | Status |
|---------|------|--------|-------------|--------|
| Mixpost | 9000 | social.auraspace.cafe | docker-compose.mixpost.yml | 🟡 pending |
| pretix | 9001 | tickets.auraspace.cafe | docker-compose.pretix.yml | 🟡 pending |
| Xibo CMS | 8080 | signage.auraspace.cafe | (manual install) | 🟢 live |
| Mautic | 8081 | marketing.auraspace.cafe | (manual install) | 🟢 live |
| Cal.com | 3000 | cal.auraspace.cafe | (SaaS) | 🟢 live |

## Biến moi trường Cloudflare / Worker Env Vars

Cần thêm vao `wrangler.toml` hoặc Cloudflare Dashboard:

```toml
[vars]
# Mixpost Social Media Bridge
MIXPOST_API_URL = "https://social.auraspace.cafe"
MIXPOST_ACCOUNTS = ""  # Comma-separated Mixpost account IDs, e.g. "1,2"

# pretix Event Ticketing Bridge
PRETIX_API_URL = "https://tickets.auraspace.cafe"
PRETIX_ORGANIZER = "aura-cafe"
```

Biến bảo mật (set via CLI, KHONG commit):

```bash
# Mixpost
npx wrangler secret put MIXPOST_API_TOKEN     # Bearer token from Mixpost admin
npx wrangler secret put MIXPOST_APP_KEY       # Laravel APP_KEY (base64:...)

# pretix
npx wrangler secret put PRETIX_API_TOKEN       # Token from pretix admin UI
npx wrangler secret put PRETIX_WEBHOOK_SECRET  # Random 32-char HMAC secret
```

## Nginx Reverse Proxy (template)

```nginx
# /etc/nginx/sites-available/aura-services

# Mixpost
server {
    server_name social.auraspace.cafe;
    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# pretix
server {
    server_name tickets.auraspace.cafe;
    client_max_body_size 50M;
    location / {
        proxy_pass http://127.0.0.1:9001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# SSL certificates
certbot --nginx -d social.auraspace.cafe -d tickets.auraspace.cafe
```

## Triển khai Cloudflare Worker / Deploy Worker

```bash
cd apps/sophia-ai-factory  # hoặc cd worker/
npm run deploy:full         # Build + deploy to CF Workers
npm run deploy:verify       # Verify SHA match
```

## Kiểm tra / Verification

```bash
# Mixpost
curl https://fnb-caffe-container.pages.dev/api/mixpost/accounts

# pretix
curl https://fnb-caffe-container.pages.dev/api/pretix/events

# Health check
curl https://fnb-caffe-container.pages.dev/api/health
```
