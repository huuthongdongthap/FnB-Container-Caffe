'use client';

import { Users } from 'lucide-react';

/**
 * Team section showing 4 members for StitchAbout page.
 */
export function TeamSection() {
  const team = [
    { name: "Nguyen Van Minh", role: "Founder & Head Roaster", desc: "15+ years in specialty coffee. Curates every bean lot and roast profile." },
    { name: "Tran Thi Lan", role: "Operations Director", desc: "Ensures seamless service across all 5 container zones, from Jade Counter to VIP Steel Nest." },
    { name: "Le Hoang Duc", role: "Creative & Brand Lead", desc: "Industrial-design-first brand identity from container architecture to digital touchpoints." },
    { name: "Pham Quoc Bao", role: "Tech & Systems Architect", desc: "QR ordering, POS integrations, and the digital ecosystem that runs AURA." },
  ];

  return (
    <section className="px-[var(--aura-container-padding,24px)] py-24 md:py-32" style={{ backgroundColor: "var(--aura-bg-surface, #0d1b2a)" }}>
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-16 text-center md:mb-24">
          <h2 className="mb-4 text-4xl md:text-5xl" style={{ color: "var(--aura-text-primary, #e8e8e8)", fontFamily: 'var(--aura-font-display, "Libre Caslon Text", Georgia, serif)' }}>
            The Minds Behind the Machine
          </h2>
          <p className="mx-auto max-w-xl font-light leading-relaxed" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}>
            Four specialists. One obsession — making AURA CAFE the most precise nocturnal experience in the Mekong Delta.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {team.map((member) => (
            <div key={member.name} className="glass-card-about flex flex-col items-center p-8 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: "var(--aura-bg-elevated, #162a3d)", border: "1px solid var(--aura-border-muted, rgba(168, 169, 173, 0.2))" }}>
                <Users className="h-8 w-8" style={{ color: "var(--aura-tertiary, #d4a574)" }} />
              </div>
              <h3 className="mb-1 text-lg font-semibold text-white" style={{ fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)' }}>{member.name}</h3>
              <span className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--aura-tertiary, #d4a574)" }}>{member.role}</span>
              <p className="text-sm leading-relaxed" style={{ color: "var(--aura-text-secondary, #a0a8b0)" }}>{member.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
