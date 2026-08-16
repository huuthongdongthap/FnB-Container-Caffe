# Browser Error Report — 2026-08-15

## Observed
- Live preview: `https://8054dd7f.fnb-caffe-container.pages.dev`
- Page renders React error boundary: "Something went wrong / Đã xảy ra lỗi"
- Footer loads, so app shell mounts but main content crashes
- No JS console errors via AppleScript (Echo > Safari > `do JavaScript`)
- `document.readyState === "complete"`, root has 1 child (error boundary)

## Likely cause
- Runtime JS exception thrown during hydration/render
- Hard to capture console errors via AppleScript; need offline reproduction

## Error boundary location
- `src/components/shared/ErrorBoundary.tsx`

## Next
- Reproduce locally: `npm run dev` with inspected console
- Run code-reviewer on auth provider + error boundary + public routes
- Capture real stack trace from dev server