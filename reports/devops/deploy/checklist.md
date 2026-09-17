# Pre-flight Checklist — 2026-09-11

| Check | Status |
|-------|--------|
| Git working tree — uncommitted changes noted | ⚠️ 9 modified files (Stitch track-order + worker telegram/order updates) |
| Frontend build (`vite build`) | ✅ OK |
| Frontend tests | ✅ 357 files / 3249 tests passed |
| Worker tests | ✅ 151 files / 1551 tests passed |
| Worker deploy (`wrangler deploy`) | ✅ v92f52c22-b1b0-46c8-8d3a-7eb46cf59689 |
| Frontend deploy (Cloudflare Pages) | ✅ https://5b9e8842.fnb-caffe-container.pages.dev |
| BE health check | ✅ 200 (auth gate active) |
| FE health check | ✅ HTTP 200 |
