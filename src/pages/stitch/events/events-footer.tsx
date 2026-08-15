export function EventsFooter() {
  return (
    <footer className="border-t border-[var(--aura-border-chrome)]/30 bg-[var(--aura-noir-deep)]/50">
      <div className="max-w-[1200px] mx-auto px-5 md:px-16 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand */}
        <span className="font-display text-base md:text-lg text-[var(--aura-chrome-mid)] tracking-widest uppercase">
          AURA CAFE
        </span>

        {/* Social links */}
        <div className="flex items-center gap-6">
          <a
            href="#"
            className="font-body text-sm text-[var(--aura-chrome-dark)] hover:text-[var(--aura-chrome-bright)] transition-colors"
            aria-label="Instagram"
          >
            📷 IG
          </a>
          <a
            href="#"
            className="font-body text-sm text-[var(--aura-chrome-dark)] hover:text-[var(--aura-chrome-bright)] transition-colors"
            aria-label="Facebook"
          >
            📘 FB
          </a>
          <a
            href="#"
            className="font-body text-sm text-[var(--aura-chrome-dark)] hover:text-[var(--aura-chrome-bright)] transition-colors"
            aria-label="TikTok"
          >
            🎵 TT
          </a>
        </div>

        {/* Copyright */}
        <p className="font-body text-xs text-[var(--aura-chrome-dark)] tracking-wider">
          &copy; 2024 AURA CAFE. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
