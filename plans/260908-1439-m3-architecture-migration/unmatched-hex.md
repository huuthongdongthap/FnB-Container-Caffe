# Unmatched / Fuzzy Hex — Mapping Decisions (Phase 5)

**Generated:** 2026-09-09 · Mapper: `scripts/migrate-stitch-hex.mjs`
**Scan:** 338 files → 189 files with raw colors · 1179 occurrences
**Final state:** exact/canonical 1160 (98.4%) · fuzzy 1 · unmatched/rgba 18
**All fuzzy mismatches resolved via CANONICAL overrides in mapper.**

## Canon (mapper CANONICAL table — v6 gold/bronze → v7 chrome)

| Hex | Token | Count | Ghi chú |
|-----|-------|-------|---------|
| `#d4a574` | `--aura-chrome-light` | 41 | v6 gold-primary |
| `#f2c08d` | `--aura-chrome-light` | 41 | v6 gold-bright |
| `#efbd8a` | `--aura-chrome-light` | 40 | v6 gold-warm |
| `#CD7F32` | `--aura-chrome-mid` | 18 | bronze (sienna) |
| `#8a7a6a` | `--aura-text-muted` | 21 | warm grey |
| `#eae1db` | `--aura-chrome-bright` | 18 | cream |
| `#c49271` | `--aura-chrome-mid` | 6 | tan mid |
| `#ffb779` | `--aura-chrome-bright` | 8 | light warm |
| `#A0522D` | `--aura-chrome-mid` | 7 | sienna |
| `#e5c099` | `--aura-chrome-light` | 4 | light tan |
| `#dfaf7e` / `#ffddba` | chrome-light / bright | 3+3 | warm light |
| `#472a03` | `--aura-noir-void` | 4 | dark brown bg |
| `#ff6b6b` | `--aura-danger` | 3 | red accent |
| `#7c838a` | `--aura-text-muted` | 2 | grey |

## Fuzzy → promoted to CANONICAL (mapper auto, all resolved)

Các hex sau đã fuzzy-match đúng token (ΔE ≤ 20, ΔLightness ≤ 3%) và được
promote vào CANONICAL table để stable + traceable:

| Hex | Token | Count |
|-----|-------|-------|
| `#c6c6c7` | `--aura-text-body` | 72 |
| `#e8e8e8` | `--aura-chrome-bright` | 53 |
| `#1e3550` | `--st-on-primary` | 43 |
| `#273647` | `--st-surface-container-highest` | 16 |
| `#8e9097` | `--aura-text-muted` | 13 |
| `#23364e` | `--st-surface-container-highest` | 12 |
| `#d4e4fa` | `--aura-chrome-bright` | 11 |
| `#1a1008` / `#16130f` | `--aura-noir-void` | 13 |
| `#c4c6ce`/`#c7c6c4`/`#b5c8e7`/`#c5c6cd`/`#BCC6CC`/`#c1c7cf` | `--aura-text-body` | 24 |
| `#d9e3f6`/`#d8e3fb`/`#d3e4ff`/`#adc8f5`/`#d4d4d8` | chrome-bright/light | 15 |
| `#0b2038`/`#071c33`/`#0c1c30`/`#0d1b2a`/`#00142b`/`#00142c`/`#050D17`/`#131315`/`#000f22`/`#050f1c`/`#010f1f`/`#000e22`/`#000e23`/`#2a1e10` | `--aura-noir-deep` / `--aura-noir-void` | 33 |
| `#162a44` | `--aura-bg-elevated` | 5 |
| `#1a1a2e`/`#091421`/`#0a1628`/`#2c1700`/`#2b1701`/`#291500`/`#051424`/`#061c35`/`#152031`/`#0b203a`/`#0c1a2d`/`#0c2038`/`#001a38`/`#1f2a3c` | noir-deep/void/steel | 19 |
| `#e5e2e1`/`#e5e4e2`/`#e4e2e4`/`#E3E2E3` | `--aura-chrome-bright` | 15 |
| `#94A3B8`/`#a1a1aa`/`#6984ad`/`#90A4AE` | text-secondary/muted | 5 |
| `#1e314a`/`#273a55`/`#39475e`/`#475569`/`#546E7A` | st-on-primary/steel/muted | 10 |

### Resolved trap mappings

1. Beige/grey hexes (`#E5E4E2` family) — mapper từng sai về `--st-on-error-container` (#FFDAD6) → **override `--aura-chrome-bright`** ✅
2. Dark navy hexes — mapper từng sai về `--text-white` (giá trị thực NAVY #0F172A, legacy naming bug) → **override `--aura-noir-deep`/`--aura-noir-void`** ✅

## RGBA cores → tokens (alpha giữ nguyên bằng color-mix hoặc var() partial)

| RGBA core | Token |
|-----------|-------|
| `242,192,141` / `212,165,116` / `239,189,138` / `229,192,153` | `--aura-chrome-light` |
| `255,183,121` / `255,221,186` / `229,228,226` | `--aura-chrome-bright` |
| `205,127,50` / `100,66,26` | `--aura-chrome-mid` |
| `196,146,113` | `--aura-chrome-light` |
| `198,198,199` | `--aura-chrome-light` (grey glass) |
| `30,41,59` / `18,37,61` / `26,38,53` / `11,32,56` / `2,20,41` / `8,20,37` / `21,32,49` / `10,26,46` / `12,32,56` / `22,42,68` / `21,33,43` / `22,32,47` / `11,32,58` / `0,20,44` / `26,43,66` / `25,45,75` / `16,20,23` / `28,20,14` / `24,16,10` | `--aura-glass-bg` (noir navy glass) |
| `148,163,184` / `184,199,226` / `187,199,222` / `107,159,184` / `201,214,223` / `197,198,205` | `--aura-glass-border` |
| `142,144,151` / `168,169,173` / `161,161,170` / `229,231,235` | `--aura-border-muted` |
| `68,71,77` | `--aura-border-chrome` |
| `255,180,171` | `--aura-error` |

## Giữ nguyên (không map — 18 occurrences, 11 unique)

- `rgba(0,0,0,*)` × 10 — black glass/overlay, không có token tương đương
- `rgba(255,255,255,≥0.2)` × 8 — white overlay cao, khác glass-bg semantics

## False positives (bỏ qua khi edit — KHÔNG phải màu)

- `#012` × 1 (StitchAdminTerminalNew.tsx:25) — terminalId string `'Terminal #012'`
- `#9842`/`#9843`/`#9841`/`#9844`/`#9838` (stitch-kds-default.ts) — KDS order IDs, đã loại khỏi regex

## Batch state

- Batch view: `hex-batch-view.tsv` (189 files, exact/fuzzy/unmatched counts)
- Full report: `hex-report.json` (line-level findings)
- Áp dụng theo batch: 176 files exact-only · 1 fuzzy-only · 12 has-unmatched (chỉ black/white overlays)
