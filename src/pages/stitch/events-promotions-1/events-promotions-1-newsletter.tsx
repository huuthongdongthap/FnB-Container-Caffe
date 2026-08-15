import type { RefObject } from 'react';

interface NewsletterProps {
  newsletterRef: RefObject<HTMLElement | null>;
  isVisible: boolean;
}

export function EventsNewsletter({ newsletterRef, isVisible }: NewsletterProps) {
  return (
    <section
      ref={newsletterRef}
      id="newsletter"
      className={`py-20 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
    >
      <div className="max-w-[800px] mx-auto px-8 text-center">
        <h2 className="font-display text-4xl md:text-5xl italic mb-6">
          Join the Circle
        </h2>
        <p className="font-body text-base text-[var(--aura-chrome-mid)] mb-10 max-w-lg mx-auto">
          Subscribe to receive early access to event bookings and exclusive
          monthly promotions curated for our inner circle.
        </p>
        <form
          className="flex flex-col md:flex-row gap-3 items-center justify-center p-3 rounded-full border border-white/10 max-w-xl mx-auto shadow-xl"
          style={{ backgroundColor: 'var(--aura-noir-deep)' }}
        >
          <input
            type="email"
            placeholder="Email Address"
            required
            className="w-full md:flex-1 bg-transparent border-none focus:ring-0 px-6 py-3 font-body text-sm text-[var(--aura-chrome-bright)] placeholder:text-[var(--aura-chrome-dark)]"
          />
          <button
            type="submit"
            className="w-full md:w-auto px-10 py-3 font-body text-xs font-semibold uppercase tracking-widest rounded-full bg-[var(--aura-chrome-bright)] text-[var(--aura-noir-void)] hover:bg-[var(--aura-neon-bronze)] hover:text-[var(--aura-noir-deep)] transition-all duration-300"
          >
            Subscribe
          </button>
        </form>
        <p
          className="mt-6 font-body text-xs tracking-widest uppercase opacity-60"
          style={{ color: 'var(--aura-chrome-dark)' }}
        >
          Frequency: Bi-weekly
        </p>
      </div>
    </section>
  );
}
