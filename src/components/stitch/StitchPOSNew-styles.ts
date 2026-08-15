/* ─── Styles ────────────────────────────────────────────────────────── */
export const POS_STYLES = `
  .glass-card {
  --aura-bg-page: #16130f;
  --aura-primary: #f2c08d;
  --aura-text-primary: #eae1db;
  --aura-primary-container: #d4a574;
  --aura-secondary: #efbd8a;
  --aura-secondary-container: #64421a;

    background: rgba(28, 20, 14, 0.55);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(242, 192, 141, 0.08);
    border-radius: 12px;
  }
  .industrial-gradient {
    background: linear-gradient(135deg, #2a1e10 0%, #1a1008 100%);
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
