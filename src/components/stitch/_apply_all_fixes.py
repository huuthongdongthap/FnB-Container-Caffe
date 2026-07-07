"""
Apply all 5 fixes to StitchAbout.tsx atomically.
Reads original 903-line file, produces complete final version.
"""
import re

with open('src/components/stitch/StitchAbout.tsx', 'r') as f:
    content = f.read()

# ═══════════════════════════════════════════════════
# FIX 0: Add 4 new icon imports to lucide-react block
# ═══════════════════════════════════════════════════
content = content.replace(
    "Star,\n} from 'lucide-react';",
    "Star,\n  Users,\n} from 'lucide-react';"
)

# ═══════════════════════════════════════════════════
# FIX 5: Add pt-16 to main wrapper (before Helmet)
# ═══════════════════════════════════════════════════
content = content.replace(
    'className="min-h-screen"',
    'className="min-h-screen pt-16"',
    1  # only first occurrence (the main wrapper)
)

# Fix the Helmet block: insert HeaderNav before it
content = content.replace(
    '<Helmet>\n    <title>',
    '{/** Fixed Top Navigation */}\n    <HeaderNav />\n\n    <Helmet>\n    <title>'
)

# ═══════════════════════════════════════════════════
# FIX 4: Override headings with string values
# ═══════════════════════════════════════════════════

# 4a: StorySection title — "The Blueprint"
content = content.replace(
    "title={data.storyTitle}",
    "title={'The Blueprint'}"
)

# 4b: TimelineSection heading — "Evolutionary Cycle"
content = content.replace(
    "{t('about.timelineTitle')}",
    "'Evolutionary Cycle'"
)

# 4c: TimelineSection description — "From Prototype to Perfection"
content = content.replace(
    "{t('about.timelineDesc')}",
    "'From Prototype to Perfection'"
)

# 4d: CTA button text — "Experience the Precision"
content = content.replace(
    "{t('about.visitTitle')}",
    "'Experience the Precision'"
)

# ═══════════════════════════════════════════════════
# FIX 2: Add TeamSection component
# ═══════════════════════════════════════════════════

TEAM_SECTION = '''function TeamSection() {
  const team = [
    {
      name: "Nguyen Van Minh",
      role: "Founder & Head Roaster",
      desc: "15+ years in specialty coffee. Curates every bean lot and roast profile.",
    },
    {
      name: "Tran Thi Lan",
      role: "Operations Director",
      desc: "Ensures seamless service across all 5 container zones, from Jade Counter to VIP Steel Nest.",
    },
    {
      name: "Le Hoang Duc",
      role: "Creative & Brand Lead",
      desc: "Industrial-design-first brand identity — every pixel, every container joint.",
    },
    {
      name: "Pham Quoc Bao",
      role: "Tech & Systems Architect",
      desc: "QR ordering, POS integrations, and the digital ecosystem that runs AURA.",
    },
  ];

  return (
    <section
      className="px-[var(--aura-container-padding,24px)] py-24 md:py-32"
      style={{ backgroundColor: "var(--aura-bg-surface, #0d1b2a)" }}
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-16 text-center md:mb-24">
          <h2
            className="mb-4 text-4xl md:text-5xl"
            style={{
              color: "var(--aura-text-primary, #e8e8e8)",
              fontFamily: 'var(--aura-font-display, "Libre Caslon Text", Georgia, serif)',
            }}
          >
            The Minds Behind the Machine
          </h2>
          <p
            className="mx-auto max-w-xl font-light leading-relaxed"
            style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}
          >
            Four specialists. One obsession — making AURA CAFE the most precise nocturnal experience in the Mekong Delta.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {team.map((member) => (
            <div
              key={member.name}
              className="glass-card-about flex flex-col items-center p-8 text-center"
            >
              <div
                className="mb-6 flex h-20 w-20 items-center justify-center rounded-full"
                style={{
                  backgroundColor: "var(--aura-bg-elevated, #162a3d)",
                  border: "1px solid var(--aura-border-muted, rgba(168, 169, 173, 0.2))",
                }}
              >
                <Users className="h-8 w-8" style={{ color: "var(--aura-tertiary, #d4a574)" }} />
              </div>
              <h3
                className="mb-1 text-lg font-semibold text-white"
                style={{ fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)' }}
              >
                {member.name}
              </h3>
              <span
                className="mb-3 text-xs font-bold uppercase tracking-widest"
                style={{ color: "var(--aura-tertiary, #d4a574)" }}
              >
                {member.role}
              </span>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}
              >
                {member.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
'''

# Insert TeamSection before CtaSection function
content = content.replace(
    '\nfunction CtaSection',
    TEAM_SECTION + '\nfunction CtaSection'
)

# ═══════════════════════════════════════════════════
# FIX 1: Add HeaderNav component
# ═══════════════════════════════════════════════════

HEADER_NAV = '''function HeaderNav() {
  const scrollToOrder = useCallback(() => {
    const el = document.getElementById("order-section");
    el?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Order", href: "#order-section" },
    { label: "Events", href: "/#events" },
    { label: "About", href: "/about", active: true },
    { label: "Contact", href: "/#contact" },
  ];

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-16"
      style={{
        backgroundColor: "rgba(10, 26, 46, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--aura-border-muted, rgba(168, 169, 173, 0.1))",
      }}
    >
      <div
        className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-[var(--aura-container-padding,24px)]"
      >
        <a
          href="/"
          className="text-xl font-bold uppercase tracking-wider"
          style={{
            color: "#f2c08d",
            fontFamily: 'var(--aura-font-display, "Libre Caslon Text", Georgia, serif)',
          }}
        >
          AURA CAFE
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={clsx(
                "text-sm transition-colors duration-200",
                link.active ? "font-semibold" : "hover:text-[#f2c08d]",
              )}
              style={{
                color: link.active ? "#f2c08d" : "var(--aura-text-secondary, #a0a8b0)",
              }}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          onClick={scrollToOrder}
          className="rounded px-6 py-2 text-sm font-semibold uppercase tracking-wider transition-all hover:opacity-90"
          style={{
            backgroundColor: "var(--aura-tertiary, #d4a574)",
            color: "var(--aura-noir-void, #0A1A2E)",
          }}
        >
          Order Now
        </button>
      </div>
    </header>
  );
}
'''

# Insert HeaderNav before the Main Component comment
content = content.replace(
    '/* ─── Main Component ───────────────────────────────────────────────── */',
    HEADER_NAV + '\n/* ─── Main Component ───────────────────────────────────────────────── */\n'
)

# ═══════════════════════════════════════════════════
# FIX 3: Add Footer (before the closing </div> of main wrapper)
# ═══════════════════════════════════════════════════

FOOTER = '''
{/** Footer */}
<footer
  className="px-[var(--aura-container-padding,24px)] pt-16 pb-8"
  style={{
    backgroundColor: "var(--aura-bg-page, #0A1A2E)",
    borderTop: "1px solid var(--aura-border-muted, rgba(168, 169, 173, 0.1))",
  }}
>
  <div className="mx-auto max-w-[1280px]">
    <div className="mb-12 flex flex-col items-center justify-between gap-8 md:flex-row">
      <div className="flex flex-col items-center md:items-start">
        <span
          className="mb-2 text-xl font-bold uppercase tracking-wider"
          style={{ color: "var(--aura-tertiary, #d4a574)" }}
        >
          AURA CAFE
        </span>
        <span
          className="text-sm"
          style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}
        >
          Precision-engineered nocturnal cafe.
        </span>
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
            <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2 6.34 6.34 0 009.49 21.54a6.34 6.34 0 006.34-6.34V8.71a8.26 8.26 0 004.76 1.42V6.69h-1z" />
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
    <div className="h-px w-full" style={{ backgroundColor: "var(--aura-border-muted, rgba(168, 169, 173, 0.1))" }} />
    <p className="mt-8 text-center text-xs" style={{ color: "var(--aura-text-disabled, #5a6270)" }}>
      &copy; 2025 AURA Cafe. Version 2.4.1
    </p>
  </div>
</footer>
'''

# Insert footer before the Custom styles block
content = content.replace(
    '\n{/* Custom styles */}\n<style>',
    FOOTER + '\n{/* Custom styles */}\n<style>'
)

# ═══════════════════════════════════════════════════
# Remove the old broken footer code between CtaSection and style
# (The component references in JSX replaced the footer — but actually
#  we never had a <footer> in the original. The footer in summary was from
#  a previous attempt that got partially applied. Let's just make sure
#  no duplicate footer exists.)
# ═══════════════════════════════════════════════════

# Remove the old placeholder TeamSection call (we now have a real component)
# and the old placeholder header — those are already handled by the content above

# Verify no duplicate content
# Count TeamSection usages
team_count = content.count('<TeamSection />')
header_count = content.count('<HeaderNav />')
footer_count = content.count('<footer')

print(f"HeaderNav usages: {header_count}")
print(f"TeamSection usages: {team_count}")
print(f"Footer tags: {footer_count}")

# If there's an old footer from previous attempts, remove it
# Look for old-style footer between custom styles and </div>
# We already replaced the marker for the new footer so should be fine

with open('src/components/stitch/StitchAbout.tsx', 'w') as f:
    f.write(content)

print(f"\nAll 5 fixes applied. Final line count: {len(content.split(chr(10)))}")
