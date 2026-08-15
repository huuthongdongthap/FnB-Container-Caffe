export function ReservationStyles() {
  return (
    <style>{`
      .active-pill {
        background: #efbd8a;
        color: #081425;
      }
      .bronze-glow {
        box-shadow: 0 0 15px rgba(212, 165, 116, 0.3);
      }
      .metallic-divider {
        height: 1px;
        width: 100%;
        background: linear-gradient(90deg, transparent 0%, #c6c6c7 50%, transparent 100%);
        opacity: 0.2;
      }
      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `}</style>
  );
}
