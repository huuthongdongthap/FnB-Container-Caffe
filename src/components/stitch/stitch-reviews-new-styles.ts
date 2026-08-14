/**
 * StitchReviewsNew — Custom CSS classes
 *
 * Glassmorphism cards, bronze glow, chrome gradient, photo hover, and
 * scrollbar styling injected via a <style> tag in the main component.
 * Extracted here for clean separation from JSX.
 */

export const REVIEWS_STYLES = `
  /* Glass card */
  .glass-card {
    background: rgba(11, 32, 56, 0.6);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid rgba(198, 198, 199, 0.15);
    border-left: 1px solid rgba(198, 198, 199, 0.15);
    border-right: 1px solid transparent;
    border-bottom: 1px solid transparent;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }
  .glass-card:hover {
    transform: translateY(-4px);
    box-shadow: 0px 0px 15px rgba(212, 165, 116, 0.15);
  }

  /* Bronze glow for highlighted card */
  .bronze-glow {
    border: 1px solid var(--aura-chrome-bright);
    box-shadow: inset 0 0 10px rgba(212, 165, 116, 0.1);
  }

  /* Chrome gradient for buttons */
  .chrome-gradient {
    background: linear-gradient(135deg, #c6c6c7 0%, #e3e2e3 50%, var(--aura-chrome-dim) 100%);
  }

  /* Photo hover effects */
  .review-photo {
    filter: grayscale(0.4) contrast(1.1);
    transition: filter 0.3s ease;
  }
  .review-photo:hover {
    filter: grayscale(0) contrast(1);
  }

  /* Custom scrollbar */
  .reviews-scrollbar::-webkit-scrollbar { width: 6px; }
  .reviews-scrollbar::-webkit-scrollbar-track { background: #000f22; }
  .reviews-scrollbar::-webkit-scrollbar-thumb { background: var(--aura-chrome-dim); border-radius: 10px; }
`;
