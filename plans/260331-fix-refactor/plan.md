# FnB Container Caffe — Fix Refactor v2.1.0
# CTO Dispatch Plan

**Ngày:** 2026-03-31 | **Target:** v2.1.0
**Dispatcher:** CTO | **Workers:** 2 panes (Pane 0 + Pane 1)
**Session:** tom_hum:fnb

---

## Tình trạng codebase (scan 2026-03-31)

| Issue | Severity | Detail |
|-------|----------|--------|
| Python dead code | 🔴 | `src/main.py` + `src/api/` (4 files) + `src/__init__.py` |
| Tests broken | 🔴 | `jest-environment-jsdom` chưa install → 0 test chạy |
| 24 .min files in git | 🟡 | Nên build by CI, không commit |
| 9 PNG files ở root | 🟡 | 500KB+ mỗi file, nên vào `assets/` |
| Duplicate styles.css | 🟡 | `./styles.css` (104KB) + `./css/styles.css` (40KB) |
| Version mismatch | 🟡 | config.yaml=v1.0.0, package.json=v2.0.0 |
| No git tags | 🟡 | `git tag -l` trống |
| 4 console.log | 🟢 | Trong js/ và worker/src/ |
| 2 TODO/FIXME | 🟢 | Cần resolve |
| 5 Python test orphans | 🟡 | test_*.py không có pytest config |

---

## Quyết định kiến trúc

1. ✅ Xóa Python legacy hoàn toàn (đã migrate sang CF Workers)
2. ✅ Xóa .min files khỏi git (CI sẽ build)
3. ✅ Reset version về v2.1.0 (nối tiếp v2.0.0)
4. ✅ Push tags lên GitHub sau khi xong

---

## Sprint 1: Cleanup & Structure (8 tasks)

Chạy tuần tự trên 2 panes: T1→T3→T5→T7 (P0) và T2→T4→T6→T8 (P1)

### T1 → Pane 0: Xóa Python Dead Code
### T2 → Pane 1: Fix Test Environment
### T3 → Pane 0: Dọn Root PNGs + Dead Files
### T4 → Pane 1: Fix console.log + TODO/FIXME
### T5 → Pane 0: .gitignore .min Files
### T6 → Pane 1: Fix Version + Config Sync
### T7 → Pane 0: .editorconfig + Code Style
### T8 → Pane 1: Update README + CHANGELOG

## Sprint 2: Build & Verify (4 tasks)

### T9 → Pane 0: Full Build Pipeline Test
### T10 → Pane 0: Test Coverage Report
### T11 → Pane 1: Git Tags (v1.0.0, v2.0.0, v2.1.0)
### T12 → Pane 1: Final Verification Report

---

## Success Criteria

| Gate | Target |
|------|--------|
| npm run lint | 0 errors |
| npm run build | ✅ success |
| npm test | All suites PASS |
| Python files | 0 (removed) |
| Root PNG files | 0 (moved) |
| .min tracked in git | 0 (gitignored) |
| Version consistency | 2.1.0 everywhere |
| Git tags | v1.0.0, v2.0.0, v2.1.0 |
| console.log (non-error) | 0 |
| TODO/FIXME | 0 |
