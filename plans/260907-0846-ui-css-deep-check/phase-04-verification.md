# Phase 4 — Verification & Cleanup

**Priority:** P0 (bắt buộc trước khi merge) · **Status:** Completed · **Depends:** Phase 1, 2, 3

## Steps

1. **Browser audit (dev :8082, Playwright headless):**
   - `/order` — load OK, không ErrorBoundary, console clean (không "Maximum update depth")
   - `/events` — render demo events hero + cards, không còn "Không thể tải sự kiện"
   - `/loyalty` — empty state heading computed fontFamily = Quicksand (không Libre Caslon)
   - Re-run section inventory script cho 3 trang trên — confirm không regression
2. **Tests:**
   - `npm test` (vitest) — frontend existing tests pass
   - `cd worker && npm test` — worker tests pass (Phase 2 không đụng worker nhưng chạy cho chắc)
3. **Build:**
   - `npm run build` — production build pass, không type error
4. **Cleanup:**
   - Xóa `ui-css-audit.tmp.mjs`, `ui-css-audit2.tmp.mjs` khỏi project root
   - Xóa `atmos-test.jpg` khỏi job tmp (auto-cleanup, chỉ kiểm tra)
5. **Code review** — theo workflow, delegate `code-reviewer` cho diff các phase 1-3

## Todo

- [ ] Browser audit 3 trang (/order, /events, /loyalty)
- [ ] Frontend tests pass
- [ ] Worker tests pass
- [ ] Production build pass
- [ ] Xóa 2 temp audit scripts khỏi project root
- [ ] Code review pass

## Success Criteria

- 100% các check trên green — không bỏ qua failure nào
- Temp files sạch khỏi project root (git status clean trừ changes có chủ đích)

## Notes

- Dev stack đang chạy background: worker :8787, Vite :8082 — dùng trực tiếp cho audit
- Nếu test fail → quay lại phase tương ứng fix → re-verify (2 strikes rule áp dụng)
