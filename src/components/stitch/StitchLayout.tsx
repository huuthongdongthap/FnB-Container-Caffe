import { ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/* PageHeader                                                          */
/* ------------------------------------------------------------------ */
export interface PageHeaderProps {
brand?: string;
rightContent?: ReactNode;
scrollEffect?: boolean;
sticky?: boolean; // when true: sticky top-0; when false (default): fixed top-0
className?: string;
}

export function PageHeader({
brand = 'AURA CAFE',
rightContent,
scrollEffect = false,
sticky = false,
className = '',
}: PageHeaderProps) {
const positionClass = sticky ? 'sticky top-0' : 'fixed top-0';
const base = `${positionClass} w-full z-50 flex items-center justify-between px-5 h-14`;

const bgClass = scrollEffect
? 'bg-[var(--aura-noir-deep)]/90 backdrop-blur-xl shadow-lg transition-all duration-500'
: 'bg-[var(--aura-surface-container)]/60 backdrop-blur-xl border-b border-white/20';

return (
<header className={`${base} ${bgClass} ${className}`}>
<div className="font-display text-headline-sm text-[var(--aura-tertiary)] tracking-wider">
{brand}
</div>
{rightContent && (
<div className="flex items-center gap-3">{rightContent}</div>
)}
</header>
);
}

/* ------------------------------------------------------------------ */
/* FooterSocialLinks                                                   */
/* ------------------------------------------------------------------ */
export interface FooterSocialLinksProps {
links: { label: string; href?: string }[];
size?: 'sm' | 'md';
className?: string;
}

export function FooterSocialLinks({
links,
size = 'sm',
className = '',
}: FooterSocialLinksProps) {
const sizeClass = size === 'md' ? 'w-10 h-10 text-xs font-bold' : 'w-8 h-8 text-xs';

return (
<div className={`flex gap-6 ${className}`}>
{links.map((link) => (
<a
key={link.label}
href={link.href ?? '#'}
className={`${sizeClass} rounded-full border border-white/10 flex items-center justify-center text-[var(--aura-chrome-mid)] hover:text-[var(--aura-tertiary)] transition-colors`}
>
{link.label}
</a>
))}
</div>
);
}

/* ------------------------------------------------------------------ */
/* FooterLegalLinks                                                    */
/* ------------------------------------------------------------------ */
export interface FooterLegalLinksProps {
links: string[];
className?: string;
}

export function FooterLegalLinks({
links,
className = '',
}: FooterLegalLinksProps) {
return (
<div className={`flex gap-6 flex-wrap justify-center ${className}`}>
{links.map((link) => (
<a
key={link}
href="#"
className="font-label-caps text-label-caps text-[10px] text-[var(--aura-chrome-mid)] hover:text-[var(--aura-tertiary)] transition-colors uppercase tracking-widest"
>
{link}
</a>
))}
</div>
);
}

/* ------------------------------------------------------------------ */
/* PageFooter                                                          */
/* ------------------------------------------------------------------ */
export interface PageFooterProps {
brand?: string;
socialLinks?: { label: string; href?: string }[];
socialSize?: 'sm' | 'md';
legalLinks?: string[];
openStatus?: ReactNode;
copyLine?: string;
className?: string;
rows?: ReactNode; // caller-supplied footer layout (overrides defaults)
}

export function PageFooter({
brand = 'AURA CAFE',
socialLinks = [],
socialSize = 'sm',
legalLinks = [],
openStatus,
copyLine,
className = '',
rows,
}: PageFooterProps) {
return (
<footer className={`border-t border-white/5 bg-[var(--aura-surface-container-lowest)] py-8 ${className}`}>
{rows ? (
<div className="max-w-7xl mx-auto px-5">
{rows}
</div>
) : (
<div className="max-w-7xl mx-auto px-5 flex flex-col md:flex-row justify-between items-center gap-4">
<div
className="font-display text-headline-md text-[var(--aura-tertiary)]"
style={{ fontFamily: 'var(--font-display, serif)' }}
>
{brand}
</div>

{socialLinks.length > 0 && (
<FooterSocialLinks links={socialLinks} size={socialSize} />
)}

{openStatus}

{legalLinks.length > 0 && (
<FooterLegalLinks links={legalLinks} />
)}

{copyLine && (
<p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] opacity-50 text-center">
{copyLine}
</p>
)}
</div>
)}
</footer>
);
}
