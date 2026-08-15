export function ContactInfoForm() {
  return (
    <section className="max-w-2xl">
      <label className="block font-label-sm text-label-sm uppercase mb-6 text-secondary">Contact Information</label>
      <div className="space-y-6">
        <div className="relative">
          <label className="font-label-sm text-label-sm uppercase text-on-surface-variant absolute -top-2.5 left-4 px-2 bg-[#081425] z-10" htmlFor="fullname">
            Full Name
          </label>
          <input
            id="fullname"
            className="w-full bg-[#1A2635] border border-outline-variant/30 rounded-xl px-6 py-4 text-on-surface focus:border-[var(--aura-tertiary)] focus:ring-1 focus:ring-[var(--aura-tertiary)] outline-none transition-all placeholder:text-outline/50"
            placeholder="John Doe"
            type="text"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative">
            <label className="font-label-sm text-label-sm uppercase text-on-surface-variant absolute -top-2.5 left-4 px-2 bg-[#081425] z-10" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              className="w-full bg-[#1A2635] border border-outline-variant/30 rounded-xl px-6 py-4 text-on-surface focus:border-[var(--aura-tertiary)] focus:ring-1 focus:ring-[var(--aura-tertiary)] outline-none transition-all placeholder:text-outline/50"
              placeholder="+1 (555) 000-0000"
              type="tel"
            />
          </div>
          <div className="relative">
            <label className="font-label-sm text-label-sm uppercase text-on-surface-variant absolute -top-2.5 left-4 px-2 bg-[#081425] z-10" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="w-full bg-[#1A2635] border border-outline-variant/30 rounded-xl px-6 py-4 text-on-surface focus:border-[var(--aura-tertiary)] focus:ring-1 focus:ring-[var(--aura-tertiary)] outline-none transition-all placeholder:text-outline/50"
              placeholder="john@example.com"
              type="email"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
