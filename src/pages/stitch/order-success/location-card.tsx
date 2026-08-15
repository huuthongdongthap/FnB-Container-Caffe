export function LocationCard() {
  return (
    <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] overflow-hidden h-40 relative group cursor-pointer transition-all duration-500 hover:border-[var(--aura-tertiary)]/40">
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-110"
        style={{
          backgroundImage:
            "url('https://lh3.googleusercontent.com/aida-public/AB6AXuB90p-HQ3qdJbW1M_x492UqW3HLs03n6XsrLpvu0QVEMyWAfjJXfgdukv-IePi8OLn_Qk9sRXhCB6TWZxQjiHd7x9Q-zKzEv3d2WN-rAGGQG1RdY0ZqNz8O3uN0qzYCM0SzE8jsiY0fnJpqyKmnBwU-X8AabgCNah__hRLDyWmhZiERlXaxI9lHVuvx09XcBxXH5agT7CFRnKpMCN0BX-7MEbyZ5crFzbW59kesuIm7l2ve_cVVnwUvWu9O6OVeVE7SMuo6ycupg')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-noir-void)] to-transparent opacity-80" />
      <div className="absolute bottom-4 left-4 flex flex-col gap-1">
        <span className="font-body text-[10px] text-[var(--aura-tertiary)] font-semibold tracking-wider uppercase">
          Location
        </span>
        <span className="font-body text-lg text-[var(--aura-chrome-bright)] font-medium">
          District 7 Station
        </span>
      </div>
      <div className="absolute top-4 right-4 bg-[var(--aura-noir-void)]/60 backdrop-blur-md p-2 rounded-full border border-white/10">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--aura-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      </div>
    </div>
  );
}
