interface FooterProps {
  onNavigate?: (path: string) => void;
}

const footerLinks = [
  { label: 'Privacy', path: '/privacy' },
  { label: 'Terms', path: '/terms' },
  { label: 'Contact', path: '/contact' },
] as const;

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="fixed bottom-0 w-full flex flex-col items-center gap-1 pb-5 z-40">
      <div className="flex gap-6 mb-2">
        {footerLinks.map((link) => (
          <button
            key={link.label}
            onClick={() => onNavigate?.(link.path)}
            className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-chrome-soft)] hover:text-[var(--aura-bronze-shimmer)] transition-colors"
          >
            {link.label}
          </button>
        ))}
      </div>
      <p className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.2em] text-[var(--aura-bronze-shimmer)]">
        &copy; 2024 AURA CAFE. INDUSTRIAL LUXURY.
      </p>
    </footer>
  );
}
