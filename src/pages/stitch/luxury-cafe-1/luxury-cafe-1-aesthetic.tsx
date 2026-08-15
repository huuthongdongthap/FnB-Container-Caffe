export function AestheticSection() {
  return (
    <section className="space-y-6" id="aesthetic">
      <div data-reveal>
        <h2 className="font-display text-4xl md:text-5xl text-[var(--aura-chrome-bright)]">The Container Aesthetic</h2>
        <div className="w-24 h-px bg-[var(--aura-tertiary)] mt-4" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        {/* Main feature card */}
        <div
          data-reveal
          className="md:col-span-7 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 flex flex-col justify-between group"
        >
          <div>
            <h3 className="font-display text-2xl md:text-3xl text-[var(--aura-tertiary)] mb-4 italic">
              Industrial Luxury Redefined
            </h3>
            <p className="font-body text-base text-[var(--aura-chrome-variant)] leading-relaxed">
              Constructed from repurposed high-cube shipping containers, our architecture celebrates
              the raw beauty of structural steel, softened by curated textures and ambient lighting.
              Each seam tells a story of global travel, now anchored in a premium urban setting.
            </p>
          </div>
          <div className="mt-8 relative overflow-hidden rounded-2xl aspect-video">
            <div className="absolute inset-0 bg-white/5 z-10 opacity-20 pointer-events-none backdrop-blur-xl" />
            <img
              className="w-full h-full object-cover grayscale-[0.5] group-hover:scale-110 transition-transform duration-700"
              data-alt="A cinematic architectural shot of a sleek black shipping container cafe at night. The structure features floor-to-ceiling frosted glass panels that emit a soft blue glow. Polished bronze accents and industrial chrome beams are visible under dramatic spotlighting. The surrounding environment is a minimalist dark navy urban plaza, creating a high-end industrial luxury atmosphere."
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBsJ-aUIE708Rnn2voLZkj1EFSTKYm9uFUUsl4N8kkRvw0mUK2olfYxBo-dx3uuGmzr9Xbj65PpNiXX0qfIpjNj1pq6PMnY2wxKt3DZfqSENNPEwFwR51It_t46VXSlUL-LrfH-Mbui8y4QoLjmgREQQyp_1fwSZy8F-Wubv5T1C51YF_V2edIcW_VmwQOuqLsY_d5b5VsbqhzXau3kfE46n7Wgn4SAY-1dov0z-6Fa3Tvm5f_YVukHL82ZefgiIPbEDjZxYbCkmdk"
            />
          </div>
        </div>

        {/* Detail cards */}
        <div className="md:col-span-5 flex flex-col gap-6">
          <div data-reveal className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-6 flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[var(--aura-tertiary)]" role="img" aria-label="layers">📐</span>
              <h4 className="font-body text-sm uppercase text-[var(--aura-chrome-mid)] tracking-widest">
                Frosted Glass Modules
              </h4>
            </div>
            <p className="font-body text-base text-[var(--aura-chrome-variant)]">
              Translucent panels provide privacy while diffusing the nocturnal urban glow,
              creating an ethereal inner sanctum.
            </p>
          </div>

          <div
            data-reveal
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-6 flex-1 border-l-4 border-l-[var(--aura-tertiary)]"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[var(--aura-tertiary)]" role="img" aria-label="precision">⚙️</span>
              <h4 className="font-body text-sm uppercase text-[var(--aura-chrome-mid)] tracking-widest">
                Chrome &amp; Bronze
              </h4>
              <div className="w-2 h-2 rounded-full bg-[var(--aura-tertiary)] animate-pulse shadow-[0_0_8px_#efbd8a]" />
            </div>
            <p className="font-body text-base text-[var(--aura-chrome-variant)]">
              Metallic accents provide a sharp contrast to the matte navy finishes,
              reflecting the precision of modern design.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
