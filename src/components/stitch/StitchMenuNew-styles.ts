export const GLASS_PANEL_STYLE_ID = '__aura_glass_panel_styles';

export const GLASS_PANEL_CSS = `
  .aura-glass {
    background: rgba(11, 32, 58, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid transparent;
    background-clip: padding-box;
    position: relative;
  }
  .aura-glass::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(135deg, #C6C6C7 0%, #4A4A4A 100%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }
  .chrome-btn {
    background: linear-gradient(135deg, #C6C6C7 0%, var(--aura-chrome-dim) 100%);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .chrome-btn:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }
  .bronze-glow {
    box-shadow: inset 0 0 10px rgba(239, 189, 138, 0.2);
  }
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`;
