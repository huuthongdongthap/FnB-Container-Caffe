export function ScrollbarStyles() {
  return (
    <style>{`
      #stitch-loyalty-scroll::-webkit-scrollbar { width: 6px; }
      #stitch-loyalty-scroll::-webkit-scrollbar-track { background: var(--aura-surface-dim); }
      #stitch-loyalty-scroll::-webkit-scrollbar-thumb { background: var(--aura-bg-high); border-radius: 10px; }
      .font-cormorant { font-family: var(--aura-font-display, 'EB Garamond', serif); }
    `}</style>
  );
}
