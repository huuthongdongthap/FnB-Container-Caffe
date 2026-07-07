# QR Phases 4 & 5 Detail

## Phase 4 — Generator Print-Groups + Bulk ZIP + i18n (3h)

**Scope:** Extend `GenerateQR.tsx` for grouped print output, implement bulk ZIP download, migrate remaining hardcoded strings to translation keys, update locale files.

**Files to modify:**
- `src/pages/admin/GenerateQR.tsx`
- `src/locales/en.json`
- `src/locales/vi.json`
- `src/pages/admin/__tests__/GenerateQR.test.tsx`

**Implementation:**
- Already has zone grouping; ensure zone headers render explicitly in print mode
- Add `bulkDownload` button: POST `/api/admin/qr/bulk-zip` returns ZIP blob
- Migrate hardcoded strings (already uses `t('qrCodes.*')` for most; add missing keys):
  - `Generate and print QR codes for tables` → `qrCodes.pageSubtitle` (EN) / `qrCodes.pageSubtitle` (VI)
  - `Zone:` label → `qrCodes.zoneFilter` (EN) / `qrCodes.zoneFilter` (VI)
  - `Regenerate All` → already has `qrCodes.regenerateAll`
  - `Print` → already has `qrCodes.printAll`
- Add new keys:
  - `qrCodes.bulkZip` / `qrCodes.bulkZipDownloading` / `qrCodes.bulkZipFailed`
  - `qrCodes.zoneLabel` / `qrCodes.tableCount`

**Acceptance:**
- `window.print()` produces A4 with zone section breaks per-group
- Bulk ZIP button visible, triggers blob download with `AURA-CAFE-qr-<date>.zip`
- All UI strings go through `useTranslations` (no hardcoded text)
- `tsc --noEmit`: 0 errors
- `vitest` GenerateQR test file: all pass

## Phase 5 — Staff Table Management i18n (3h)

**Scope:** Polish `TableManagement.tsx` with full i18n coverage and accessibility.

**Files to modify:**
- `src/pages/admin/TableManagement.tsx`
- `src/locales/en.json`
- `src/locales/vi.json`

**Implementation:**
- Add `admin.tableManagement.*` keys: title, subtitle, filters label, zone/status filter labels, bulk buttons, status labels (Available, Occupied, Reserved, Overdue, released), capacity label, KDS buttons, release button
- Migrate all hardcoded strings (currently a mix of `t('admin.tableManagement.xxx')` for some, hardcoded VN for most)
- Bilingual: VN as fallback, EN as secondary locale; both must exist before runtime

**Acceptance:**
- Every visible string in TableManagement routes through `t('admin.tableManagement.*')`
- Switch locale → page re-renders in target language without reload
- `tsc --noEmit`: 0 errors
- `vitest` overall: no new failures introduced by locale JSON changes
