/**
 * StitchAdminLoginNew — Styles
 *
 * CSS-in-JS styles matching original Stitch HTML export.
 * Glass card, chrome/silver accents, dark navy background,
 * glassmorphism panels, and industrial-luxe branding.
 */

export function getLoginStyles(): string {
  return `
    /* ─── Glass Panel ───────────────────────────────────────────── */
    .glass-panel-login-new {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    /* ─── Chrome Border ─────────────────────────────────────────── */
    .chrome-border-login-new {
      border: 1px solid transparent;
      background:
        linear-gradient(var(--aura-noir-void, #050D1A), var(--aura-noir-void, #050D1A)) padding-box,
        linear-gradient(135deg, rgba(var(--aura-glass-bg),0.267) 0%, rgba(var(--aura-glass-bg),0.067) 50%, rgba(var(--aura-glass-bg),0.267) 100%) border-box;
    }

    /* ─── Chrome Gradient Button Background ─────────────────────── */
    .chrome-gradient-bg {
      background: linear-gradient(135deg, var(--aura-chrome-bright, #E8EEF3) 0%, var(--aura-text-secondary, #90A4AE) 50%, var(--aura-text-muted, #546E7A) 100%);
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
      background: linear-gradient(90deg, transparent 0%, rgba(var(--aura-glass-bg),0.267) 50%, transparent 100%);
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
      font-family: var(--aura-font-display);
    }
    .text-display-logo {
      font-size: 32px;
      line-height: 1.2;
      letter-spacing: 0.02em;
      font-weight: 600;
    }
    .font-headline-md {
      font-family: var(--aura-font-body);
    }
    .font-label-caps {
      font-family: var(--aura-font-body);
    }
    .text-label-caps {
      font-size: 12px;
      line-height: 1.0;
      letter-spacing: 0.1em;
      font-weight: 600;
    }
    .font-body-sm {
      font-family: var(--aura-font-body);
    }
    .font-body-lg {
      font-family: var(--aura-font-body);
      font-size: 16px;
      line-height: 1.6;
      font-weight: 400;
    }

    /* ─── Color Utilities (exact hex values from original HTML) ────── */
    .text-primary { color: var(--aura-noir-void); }
    .text-primary\\/60 { color: color-mix(in srgb, var(--aura-noir-void) 60%, transparent); }
    .text-on-surface { color: var(--aura-text-primary, #F5F5F5); }
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
