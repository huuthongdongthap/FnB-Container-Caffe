export function Footer() {
  return (
    <footer className="bg-[var(--aura-noir-deep)] border-t border-white/5 py-20 px-5 md:px-16">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-[1280px] mx-auto">
        <div className="md:col-span-2">
          <div className="font-display text-xl text-[var(--aura-chrome-bright)] uppercase mb-6 tracking-widest">
            AURA CAFE
          </div>
          <p className="text-[var(--aura-chrome-mid)] max-w-sm font-body text-xs leading-relaxed mb-8">
            ENGINEERED ELEGANCE. NOCTURNAL SANCTUARY. RE-DEFINING THE ARCHITECTURE OF HOSPITALITY
            THROUGH PRECISION AND SALVAGE.
          </p>
          <div className="flex gap-6">
            <a
              className="text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
              href="#"
            >
              📢
            </a>
            <a
              className="text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
              href="#"
            >
              📍
            </a>
            <a
              className="text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
              href="#"
            >
              ✉️
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h5 className="text-white font-bold uppercase tracking-widest text-xs mb-2 font-body">
            Legal &amp; Ethics
          </h5>
          <a
            className="font-body text-sm text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
            href="#"
          >
            Privacy Policy
          </a>
          <a
            className="font-body text-sm text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
            href="#"
          >
            Terms of Service
          </a>
          <a
            className="font-body text-sm text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
            href="#"
          >
            Sustainability
          </a>
        </div>

        <div className="flex flex-col gap-4">
          <h5 className="text-white font-bold uppercase tracking-widest text-xs mb-2 font-body">
            Company
          </h5>
          <a
            className="font-body text-sm text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
            href="#"
          >
            Careers
          </a>
          <a
            className="font-body text-sm text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
            href="#"
          >
            Press Kit
          </a>
          <a
            className="font-body text-sm text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
            href="#"
          >
            Contact
          </a>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="font-body text-xs text-[var(--aura-chrome-mid)]">
          &copy; 2024 AURA CAFE. ENGINEERED ELEGANCE.
        </p>
        <p className="font-body text-[10px] text-[var(--aura-chrome-mid)] tracking-widest">
          VERSION 2.0.4 // SYSTEM: ACTIVE
        </p>
      </div>
    </footer>
  );
}
