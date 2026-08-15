/**
 * StitchAdminLoginNew — Styles
 *
 * CSS-in-JS styles matching original Stitch HTML export.
 * Glass card, chrome/silver accents, dark navy background,
 * glassmorphism panels, and industrial-luxe branding.
 */

export function getLoginStyles(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,600&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');

    /* ─── Glass Panel ───────────────────────────────────────────── */
    .glass-panel-login-new {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
    }

    /* ─── Chrome Border ─────────────────────────────────────────── */
    .chrome-border-login-new {
      border: 1px solid transparent;
      background:
        linear-gradient(#131315, #131315) padding-box,
        linear-gradient(135deg, rgba(255,255,255,0.267) 0%, rgba(255,255,255,0.067) 50%, rgba(255,255,255,0.267) 100%) border-box;
    }

    /* ─── Chrome Gradient Button Background ─────────────────────── */
    .chrome-gradient-bg {
      background: linear-gradient(135deg, #CFD8DC 0%, #90A4AE 50%, #546E7A 100%);
    }
    .chrome-gradient-bg:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      filter: none;
      transform: none;
    }

    /* ─── Chrome Line (Divider) ─────────────────────────────────── */
    .chrome-line-login-new {
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.267) 50%, transparent 100%);
    }

    /* ─── Ambient Glow ──────────────────────────────────────────── */
    .ambient-glow-login-new {
      position: absolute;
      width: 600px;
      height: 600px;
      max-width: 100vw;
      max-height: 100vw;
      background: radial-gradient(circle, color-mix(in srgb, var(--aura-noir-void) 5%, transparent) 0%, transparent 70%);
      z-index: -1;
      pointer-events: none;
    }

    /* ─── Focus Style (matches original input:focus) ──────────── */
    .focus\\:shadow-input:focus {
      outline: none !important;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.4) !important;
    }

    /* ─── Selection Style ───────────────────────────────────────── */
    ::selection {
      background-color: color-mix(in srgb, var(--aura-noir-void) 30%, transparent);
    }

	    /* ─── Font Utilities (exact match of original tailwind config) ─── */
    .font-display-logo {
      font-family: var(--aura-font-display, 'EB Garamond', serif);
    }
    .text-display-logo {
      font-size: 32px;
      line-height: 1.2;
      letter-spacing: 0.02em;
      font-weight: 600;
    }
    .font-headline-md {
      font-family: 'Space Grotesk', sans-serif;
    }
    .font-label-caps {
      font-family: 'Space Grotesk', sans-serif;
    }
    .text-label-caps {
      font-size: 12px;
      line-height: 1.0;
      letter-spacing: 0.1em;
      font-weight: 600;
    }
    .font-body-sm {
      font-family: 'Space Grotesk', sans-serif;
    }
    .font-body-lg {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 16px;
      line-height: 1.6;
      font-weight: 400;
    }

    /* ─── Color Utilities (exact hex values from original HTML) ────── */
    .text-primary { color: var(--aura-noir-void); }
    .text-primary\\/60 { color: color-mix(in srgb, var(--aura-noir-void) 60%, transparent); }
    .text-on-surface { color: #e4e2e4; }
    .text-on-surface-variant { color: var(--aura-chrome-soft); }
    .text-outline { color: var(--aura-chrome-dim); }
    .border-primary { border-color: var(--aura-noir-void); }
    .shadow-primary\\/5 {
      --tw-shadow-color: color-mix(in srgb, var(--aura-noir-void) 5%, transparent);
      --tw-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
    }
    .selection\\:bg-primary\\/30::selection {
      background-color: color-mix(in srgb, var(--aura-noir-void) 30%, transparent);
    }

    /* ─── Placeholder Color ─────────────────────────────────────── */
    .placeholder\\:text-outline\\/40::placeholder {
      color: color-mix(in srgb, var(--aura-chrome-dim) 40%, transparent);
    }
  `;
}
