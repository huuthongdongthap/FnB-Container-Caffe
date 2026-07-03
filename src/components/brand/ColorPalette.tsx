import { useState, useCallback } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

interface BrandColor {
  name: string;
  token: string;
  hex: string;
  category?: string;
}

interface ColorPaletteProps {
  colors: BrandColor[];
  categories?: boolean;
  className?: string;
}

export function ColorPalette({ colors, categories, className }: ColorPaletteProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = useCallback(async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(hex);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard not available
    }
  }, []);

  if (categories) {
    const grouped = colors.reduce<Record<string, BrandColor[]>>((acc, color) => {
      const cat = color.category ?? 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(color);
      return acc;
    }, {});

    return (
      <div className={cn('space-y-8', className)}>
        {Object.entries(grouped).map(([category, catColors]) => (
          <div key={category}>
            <h3 className="mb-4 font-display text-xl font-semibold text-foreground">
              {category}
            </h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {catColors.map((color) => (
                <ColorSwatch
                  key={color.hex}
                  color={color}
                  copied={copied}
                  onCopy={handleCopy}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5', className)}>
      {colors.map((color) => (
        <ColorSwatch
          key={color.hex}
          color={color}
          copied={copied}
          onCopy={handleCopy}
        />
      ))}
    </div>
  );
}

interface ColorSwatchProps {
  color: BrandColor;
  copied: string | null;
  onCopy: (hex: string) => void;
}

function ColorSwatch({ color, copied, onCopy }: ColorSwatchProps) {
  const isCopied = copied === color.hex;

  return (
    <button
      type="button"
      onClick={() => onCopy(color.hex)}
      className="group cursor-pointer text-left transition-transform duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-accent/40 rounded-xl"
      aria-label={`Copy ${color.hex}`}
    >
      <div
        className="h-20 w-full rounded-t-xl border border-border"
        style={{ backgroundColor: color.hex }}
      />
      <div className="rounded-b-xl border border-t-0 border-border bg-card p-3">
        <p className="text-sm font-semibold text-foreground">{color.name}</p>
        <code className="mt-0.5 block text-xs text-muted">{color.token}</code>
        <span className="mt-1 inline-block rounded bg-accent/10 px-2 py-0.5 font-mono text-xs text-accent">
          {isCopied ? <> <Check size={14} className="inline" /> Copied</> : color.hex}
        </span>
      </div>
    </button>
  );
}
