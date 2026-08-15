const TYPE_SCALE_ROWS = [
 { token: '--aura-fs-display', size: 'clamp(48px, 8vw, 80px)', usage: 'Hero titles' },
 { token: '--aura-fs-hero', size: 'clamp(32px, 5vw, 56px)', usage: 'Section hero' },
 { token: '--aura-fs-h1', size: 'clamp(28px, 4vw, 42px)', usage: 'Page titles' },
 { token: '--aura-fs-h2', size: 'clamp(22px, 3vw, 32px)', usage: 'Section heads' },
 { token: '--aura-fs-h3', size: '20px', usage: 'Card heads' },
 { token: '--aura-fs-body', size: '16px', usage: 'Body text' },
 { token: '--aura-fs-sm', size: '14px', usage: 'Small text, buttons' },
 { token: '--aura-fs-label', size: '11px', usage: 'Uppercase labels' },
];

export function TypeScaleTable() {
 return (
  <div className="mt-8 overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl">
   <table className="w-full text-left text-sm">
    <thead>
     <tr className="border-b border-white/[0.08]">
      <th className="px-6 py-3 font-utility text-xs font-semibold uppercase tracking-wider text-[color:var(--aura-chrome-bright)]">Token</th>
      <th className="px-6 py-3 font-utility text-xs font-semibold uppercase tracking-wider text-[color:var(--aura-chrome-bright)]">Size</th>
      <th className="px-6 py-3 font-utility text-xs font-semibold uppercase tracking-wider text-[color:var(--aura-chrome-bright)]">Usage</th>
     </tr>
    </thead>
    <tbody className="divide-y divide-border">
     {TYPE_SCALE_ROWS.map((row) => (
      <tr key={row.token} className="hover:bg-[color:var(--aura-surface-container)]/5">
       <td className="px-6 py-3 font-mono text-xs text-[color:var(--aura-chrome-bright)]">{row.token}</td>
       <td className="px-6 py-3 text-[color:var(--aura-chrome-bright)]">{row.size}</td>
       <td className="px-6 py-3 text-[color:var(--aura-chrome-bright)]">{row.usage}</td>
      </tr>
     ))}
    </tbody>
   </table>
  </div>
 );
}
