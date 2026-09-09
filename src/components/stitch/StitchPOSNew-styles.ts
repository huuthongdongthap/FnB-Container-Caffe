/* ─── Styles ────────────────────────────────────────────────────────── */
export const POS_STYLES = `
  .glass-card {
  --aura-bg-page: var(--aura-noir-void, #050D1A);
  --aura-primary: var(--aura-chrome-light, #C9D6DF);
  --aura-text-primary: var(--aura-chrome-bright, #E8EEF3);
  --aura-primary-container: var(--aura-chrome-light, #C9D6DF);
  --aura-secondary: var(--aura-chrome-light, #C9D6DF);
  --aura-secondary-container: var(--aura-noir-void, #050D1A);

    background: rgba(28, 20, 14, 0.55);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(242, 192, 141, 0.08);
    border-radius: 12px;
  }
  .industrial-gradient {
    background: linear-gradient(135deg, var(--aura-noir-void, #2a1e10) 0%, var(--aura-noir-void, #050D1A) 100%);
  }
  .bronze-glow:active {
    box-shadow: 0px 0px 12px rgba(242, 192, 141, 0.4);
    filter: brightness(1.1);
  }
  .custom-scrollbar-pos::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar-pos::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar-pos::-webkit-scrollbar-thumb {
    background: rgba(242, 192, 141, 0.2);
    border-radius: 10px;
  }
`;
