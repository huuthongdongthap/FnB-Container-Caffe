/**
 * Inline CSS for glass-card scroll reveal, active nav dot indicator,
 * and carousel scrollbar hiding.
 */
export const MOBILE_STYLES = `
  .glass-card-reveal {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1),
                transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .glass-card-reveal.revealed {
    opacity: 1;
    transform: translateY(0);
  }
  .glass-card-reveal.revealed:nth-child(2) { transition-delay: 100ms; }
  .glass-card-reveal.revealed:nth-child(3) { transition-delay: 200ms; }

  .nav-item--active { position: relative; }
  .nav-item--active::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--aura-chrome-bright);
  }

  .carousel-scroll::-webkit-scrollbar { display: none; }
  .carousel-scroll { -ms-overflow-style: none; scrollbar-width: none; }
`;
