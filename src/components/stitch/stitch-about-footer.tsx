'use client';

/**
 * Footer for StitchAbout page.
 */
export function AboutFooter() {
  return (
    <footer
      className="px-[var(--aura-container-padding,24px)] pt-16 pb-8"
      style={{
        backgroundColor: "var(--aura-bg-page, #0A1A2E)",
        borderTop: "1px solid var(--aura-border-muted, rgba(168,169,173,0.1))",
      }}
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-12 flex flex-col items-center justify-between gap-8 md:flex-row">
          <div className="flex flex-col items-center md:items-start">
            <span
              className="mb-2 text-xl font-bold uppercase tracking-wider"
              style={{ color: "var(--aura-tertiary, #d4a574)" }}
            >AURA CAFE</span>
            <span
              className="text-sm"
              style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}
            >Precision-engineered nocturnal cafe.</span>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            <a className="text-sm transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}>About</a>
            <a className="text-sm transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}>Order</a>
            <a className="text-sm transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}>Events</a>
            <a className="text-sm transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}>Privacy</a>
            <a className="text-sm transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}>Terms</a>
          </div>
          <div className="flex items-center gap-6">
            <a className="transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }} aria-label="Instagram">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
            <a className="transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }} aria-label="TikTok">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2 6.34 6.34 0 009.49 21.54 6.34 6.34 0 006.34-6.34V8.71a8.26 8.26 0 004.76 1.42V6.69h-1z" />
              </svg>
            </a>
            <a className="transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }} aria-label="Facebook">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </a>
            <a className="transition-colors hover:text-[#f2c08d]" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }} aria-label="YouTube">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>
          </div>
        </div>
        <div className="h-px w-full" style={{ backgroundColor: "var(--aura-border-muted, rgba(168,169,173,0.1))" }} />
        <p className="mt-8 text-center text-xs" style={{ color: "var(--aura-text-disabled, #5a6270)" }}>&copy; 2025 AURA Cafe. Version 2.4.1</p>
      </div>
    </footer>
  );
}
