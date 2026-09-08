# UI CSS Deep Check — Audit & Fix Plan

**Ngày:** 2026-09-07 · **Nguồn:** `/plan` + `/ui-check` "còn nhiều section chỉ là text chưa CSS, deep check toàn bộ"

## Kết quả Deep Check (16 pages, Playwright headless + code trace)

Nhận định "nhiều section chỉ là text chưa CSS" **không còn đúng** — 14/16 pages đã được style đầy đủ (brand fonts, cards, glass panels). Vấn đề thực tế là **2 functional bugs + 1 brand font inconsistency**, không phải thiếu CSS:

| # | Vấn đề | Loại | File |
|---|--------|------|------|
| 1 | `/order` crash ErrorBoundary — zustand v5 unstable inline object selector → "Maximum update depth exceeded" | Functional bug (blocker) | `src/pages/TableOrder.tsx:36-38` |
| 2 | `/events` toàn page là error state — hook gọi `/api/events` (404, worker chỉ có `/api/pretix/events`); retry button không có onClick; `errorMessage` không truyền | Functional bug | `src/hooks/use-events.ts:27`, `src/pages/events.tsx:135`, `StitchEventsNew2-empty.tsx:72-79` |
| 3 | `/loyalty` empty state dùng font "Libre Caslon Text" thay brand font (Quicksand/Be Vietnam Pro) | Brand inconsistency (minor) | `loyalty-error-state.tsx:20`, `loyalty-weekly-streak.tsx:30` |
| 4 | `/container` "Khu Chill" + "Bầu Không Khí" tưởng naked nhưng **có CSS đầy đủ** (bg ở child divs — audit heuristic false positive; bg image Atmosphere test HTTP 200 image/jpeg) | Không cần fix | — |
| 5 | Landing `/` sections text-only-on-bg — intentional design (StitchLandingNew) | Không cần fix | — |

## Phases

| Phase | Nội dung | Status | Priority |
|-------|----------|--------|----------|
| [Phase 1](phase-01-fix-order-zustand-selector.md) | Fix /order zustand selector crash | Completed | P0 |
| [Phase 2](phase-02-fix-events-api-path.md) | Fix /events API path + error state wiring | Completed | P0 |
| [Phase 3](phase-03-loyalty-brand-font.md) | /loyalty brand font consistency | Completed | P2 |
| [Phase 4](phase-04-verification.md) | Verify toàn bộ (browser audit + tests + build) | Completed | P0 |

## Dependencies

- Phase 1, 2, 3 độc lập — chạy song song được
- Phase 4 phụ thuộc cả 3

## Key Decisions (cần user confirm)

1. **Phase 2 approach:** Hook gọi đúng `/api/pretix/events` + map pretix shape → `EventItem`; khi API fail/empty → trả `[]` thay vì throw → StitchEventsNew2 tự dùng defaultData (demo events, style đầy đủ). Error state hiển thị chỉ khi user truyền `isError` explicitly.
2. **Không sửa** /container sections + landing (false positive / intentional).
3. Temp audit scripts (`ui-css-audit.tmp.mjs`, `ui-css-audit2.tmp.mjs` ở project root) sẽ bị xóa ở Phase 4.

## Next Steps

User review plan → approve → implement Phase 1-3 (song song) → Phase 4 verify.
