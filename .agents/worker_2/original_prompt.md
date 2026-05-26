# Verbatim Request

You are the Implementation Worker (self) for the Bazi v5.1 Sprint.
Your task is to implement the final Bazi-aligned polish, FOUT optimizations, and brand compliance fixes to resolve the 4 critical gaps identified during adversarial review:

### MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Scope of Work:

1. Font Preloading & FOUT Optimization in `loyalty-calculator.html` (R1):
- Locate `loyalty-calculator.html` (lines 9-12).
- Remove the Google Fonts stylesheet link that imports the banned fonts `Inter` and `Outfit`.
- Insert the standard preconnect and preload tags for Google Fonts ('Cormorant Garamond', 'Space Grotesk', 'JetBrains Mono') inside the `<head>` tag, before any CSS stylesheet links:
  ```html
  <!-- preconnect to font servers -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <!-- preload critical font files (WOFF2 format) -->
  <link rel="preload" href="https://fonts.gstatic.com/s/cormorantgaramond/v16/co3bmW5slhv3kqkk9yQStepq297QT_w.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="https://fonts.gstatic.com/s/spacegrotesk/v13/V8mQoQDjQSkFsp0FOBQYElyycToq5A.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="https://fonts.gstatic.com/s/jetbrainsmono/v18/tGLy8u1col2tc7b9_93AMsS8fknP-asG.woff2" as="font" type="font/woff2" crossorigin>
  
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  ```

2. Eliminate Banned Gold `#D4AF37` & Earth Tones (R2 & R3):
- In `designs/membership-card-template.html` (line 69), replace the banned gold gradient background `#D4AF37` and `#A0802A` with compliant silver/chrome tones (e.g. `#C9D6DF` and `#6B9FB8` / `var(--aura-chrome-light)` / `var(--aura-chrome-mid)`).
- In `js/pos.js` (line 12), replace the Earth bronze (`#A5703F`) with Steel Slate (`#94A3B8`) and gold (`#D4AF37`) with Silver (`#C9D6DF`).
- In `public/offline.html` (lines 51, 59, 64, 95), replace:
  * `#D4AF37` (retry-btn background and checkmark bullet color) with compliant Silver `#C9D6DF` or Chrome `#6B9FB8`.
  * `#6b4423` (banned brown border/hover) with Steel Slate `#3A6B80` or deep Navy `#0A1A2E`.
  * Also replace all other Earthy/banned colors: `#f5e6d3` (h1 color) with Chrome-light `#E8EEF3`, `#b8a89a` (paragraph p color) with Chrome-master `#C9D6DF`, `#8b7355` (tips h2 color) with Chrome-mid `#6B9FB8`, and `#a89888` (tips li color) with Chrome-master `#C9D6DF`.

3. Eliminate Banned Red Color `#FF5252` & Fire Tones (R3):
- In `failure.html` (lines 119, 137, 143, 163, 164, 171, 194, 195, 199, 253, 273, 279, 319, 320, 333, 340), replace:
  * Banned red colors `#FF5252`, `#ff5252`, `#ff1744`, `#FF1744`, `#FF3B30`, and `#FF6B6B` with compliant brand danger token `#DC2626` (which is `--aura-danger` in brand CSS) or cool steel-slate shades `#3A6B80` and `#4B5563` to avoid any Hỏa/Fire color leak.
  * Also change any `rgba(255, 59, 48, ...)` and similar red colors to steel-slate equivalents (e.g. `rgba(58, 107, 128, ...)`).
- In `css/kds-m3.css` (lines 27, 34, 35, 92, 102, 146), replace:
  * `--status-pending-container: rgba(255,193,7,0.15);` (banned Earth yellow) with `rgba(107, 159, 184, 0.15);` (Chrome blue).
  * `--status-delayed: #FF5252;` with `--status-delayed: #3A6B80;` (Steel Blue).
  * `--status-delayed-container: rgba(255,82,82,0.15);` with `rgba(58, 107, 128, 0.15);` (Slate blue).
  * Line 92 `color: #8B7500;` (banned gold/brown) with `color: #C9D6DF;` (Silver) or `#E8EEF3`.
  * Line 102 `color: #CC3333;` (banned red) with `color: #3A6B80;` (Slate/Steel blue).
  * Line 146 `rgba(220, 214, 23, 0.3)` (banned yellow shadow) with `rgba(107, 159, 184, 0.15)` or `rgba(0, 0, 0, 0.2)`.

4. Eliminate Banned Orange Color `#FF9800` (R3):
- In `table-reservation.html` (lines 24, 66, 76, 102):
  * Replace `--orange:#FF9800;` with compliant Chrome mid `#6B9FB8`.
  * Replace `rgba(255, 152, 0, ...)` references with compliant Chrome mid/Silver blue `rgba(107, 159, 184, ...)`.

5. Verification and Handoff:
- Run the Vite compilation command: `npm run build` and verify it succeeds with 0 errors.
- Run Jest tests: `npm test` and verify that all 14 test suites and all 78 tests pass perfectly.
- Statically audit/ripgrep active source code files (excluding legacy build `_deploy/` and `_archive/` folders) to confirm that no banned colors (#FFD700, #D4AF37, #FF6B35, #FF1744, #8B4513) or banned fonts (Playfair, Cinzel, Manrope, Inter) remain.
- Write a comprehensive handoff report to `.agents/worker_2/handoff.md` and send a message back with your results.

## 2026-05-26T07:17:31Z

**Context**: Additional Bazi v5.1 Compliance Gaps in `brand-guideline.html`
**Content**: Hello Worker 3, 

Reviewer 4 has identified two additional compliance gaps in `brand-guideline.html` that violate R1 and R2 specifications and must be remediated immediately alongside your other 4 active tasks:

1. **Lingering "Gold" (Vàng) Terminology in active brand book (R2 Violation)**:
   * **Issue**: There are still 11 active instances of "vàng", "vàng đồng", and "vàng kim" in `brand-guideline.html` (excluding the banned list on lines 520-521) that describe active design elements, packaging, uniforms, or badges.
   * **Remediation**: Scan `brand-guideline.html` and migrate these occurrences to Bazi-compliant terms: "bạc", "chrome", or "thép" to satisfy Thủy-Kim element alignment.
   
2. **Font Preload Placement Mismatch (R1 Violation)**:
   * **Issue**: In the `<head>` of `brand-guideline.html`, the CSS stylesheet import is placed *before* the font preconnect and preload tags, creating a FOUT vulnerability.
   * **Remediation**: Reorder the tags so that the preconnect and font preload tags are located *before* any stylesheet (`<link rel="stylesheet">` or inline styles) inside `<head>`.

**Action**: Please incorporate these two additional fixes into your current implementation run. Ensure that the Vite build compilations and all 14 Jest test suites continue to pass successfully after these changes are integrated. Report back once all modifications are complete and verified.
