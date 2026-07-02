# Research: Stitch MCP trong Claude Code CLI

## Phát hiện chính

Sai lầm trước đây: dùng `X-Goog-Api-Key` header. **Cách đúng là `Authorization: Bearer <token>` + `X-Goog-User-Project`.**

## Cách setup đúng

### 1. Lấy access token từ gcloud
```bash
gcloud auth application-default print-access-token
```

### 2. Add Stitch MCP với đúng headers
```bash
claude mcp add stitch \
  --transport http https://stitch.googleapis.com/mcp \
  --header "Authorization: Bearer <TOKEN>" \
  --header "X-Goog-User-Project: openclaw-raas-hub-1770348928" \
  -s user
```

### 3. Dùng được ngay!

## Tại sao API key không work

Stitch MCP HTTP transport yêu cầu OAuth2 Bearer token, không phải API key. API key chỉ work với:
- `@google/stitch-sdk` (npm package) qua `STITCH_API_KEY` env var
- `google-stitch-mcp proxy` (stdio transport) qua env var

Nhưng MCP HTTP transport built-in của Claude Code bắt buộc OAuth2 Bearer token.

## Cách dùng khác (không cần OAuth)

Dùng npm package trực tiếp thay vì built-in MCP:
```bash
claude mcp add stitch -e STITCH_API_KEY="key" -e GOOGLE_CLOUD_PROJECT="project" -- npx -y google-stitch-mcp proxy
```
Cần approve: `claude` rồi reply "yes".

## Sources
- https://github.com/google-labs-code/stitch-sdk
- https://github.com/google-labs-code/stitch-skills
- https://github.com/google-labs-code/design.md
