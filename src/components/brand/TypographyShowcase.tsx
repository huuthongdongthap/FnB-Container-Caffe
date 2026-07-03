import { cn } from '@/lib/cn';

interface FontSpec {
  name: string;
  category: string;
  usage: string;
}

interface TypographyShowcaseProps {
  fonts: FontSpec[];
  className?: string;
}

function getFontFamily(name: string): string {
  if (name === 'Cormorant Garamond') return 'Cormorant Garamond, serif';
  if (name === 'Space Grotesk') return 'Space Grotesk, sans-serif';
  if (name === 'Space Grotesk') return 'Space Grotesk, sans-serif';
  if (name === 'JetBrains Mono') return 'JetBrains Mono, monospace';
  return 'sans-serif';
}

function getSampleText(name: string): string {
  if (name === 'Cormorant Garamond') return 'AURA CAFE';
  if (name === 'Space Grotesk') return 'Cà phê vỉa hè gặp container rooftop.';
  if (name === 'JetBrains Mono') return '45.000₫ · ORDER #1247';
  return 'Sample text';
}

function getSampleSize(name: string): string {
  if (name === 'Cormorant Garamond') return 'text-3xl md:text-4xl';
  if (name === 'Space Grotesk') return 'text-base';
  return 'text-sm';
}

export function TypographyShowcase({ fonts, className }: TypographyShowcaseProps) {
  return (
    <div className={cn('grid gap-6 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {fonts.map((font) => (
        <div
          key={font.name}
          className="rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:border-accent/30"
        >
          <div className="mb-1 inline-block rounded-full bg-accent/10 px-3 py-1 font-utility text-xs font-medium text-accent">
            {font.category}
          </div>
          <div
            className={cn('mt-4 font-semibold text-foreground', getSampleSize(font.name))}
            style={{ fontFamily: getFontFamily(font.name) }}
          >
            {getSampleText(font.name)}
          </div>
          <h3
            className="mt-4 text-base font-semibold text-foreground"
            style={{ fontFamily: getFontFamily(font.name) }}
          >
            {font.name}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {font.usage}
          </p>
        </div>
      ))}
    </div>
  );
}
