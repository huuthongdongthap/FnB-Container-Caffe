import { cn } from '@/lib/cn';

interface LogoUsageProps {
  className?: string;
}

const LOGO_VARIANTS = [
  {
    name: 'Wordmark',
    description: 'Horizontal logo cho hero, website, header.',
    file: 'logo-aura-wordmark.svg',
    dimensions: '600x140',
  },
  {
    name: 'Emblem',
    description: 'Vertical logo cho bao bì, đồng phục, name tag.',
    file: 'logo-aura-emblem.svg',
    dimensions: '100x120',
  },
  {
    name: 'Favicon',
    description: 'Monogram cho tab trình duyệt, app icon.',
    file: 'favicon.svg',
    dimensions: '32x32',
  },
];

const DO_RULES = [
  'Dùng logo gốc từ assets/brand/ — không tự vẽ lại.',
  'Giữ khoảng trống tối thiểu bằng chiều cao chữ "A".',
  'Dùng wordmark trên nền tối, emblem trên nền sáng.',
];

const DONT_RULES = [
  'Không xoay, nghiêng, bóp méo logo.',
  'Không đổi màu logo (luôn chrome #C9D6DF hoặc white).',
  'Không áp dụng drop-shadow, gradient, filter lên logo.',
];

export function LogoUsage({ className }: LogoUsageProps) {
  return (
    <section className={cn('space-y-8', className)}>
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">
          Logo System
        </h2>
        <p className="mt-2 text-muted">
          Bộ nhận diện AURA CAFE bao gồm 3 dạng logo. Tất cả dựa trên hình tháp (rooftop apex)
          và giọt nước (Thủy essence).
        </p>
      </div>

      {/* Logo variants */}
      <div className="grid gap-6 sm:grid-cols-3">
        {LOGO_VARIANTS.map((logo) => (
          <div
            key={logo.name}
            className="rounded-2xl border border-border bg-card p-6 text-center"
          >
            <div className="mx-auto mb-4 flex h-24 w-full items-center justify-center rounded-xl bg-accent/5">
              <div className="text-3xl font-display text-accent" aria-hidden="true">
                {logo.name === 'Wordmark' ? 'AURA' : logo.name === 'Emblem' ? '⛩' : '✦'}
              </div>
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              {logo.name}
            </h3>
            <p className="mt-1 text-xs text-muted">{logo.dimensions}</p>
            <p className="mt-2 text-sm text-muted">{logo.description}</p>
          </div>
        ))}
      </div>

      {/* DO/DON'T rules */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6">
          <h3 className="font-display text-lg font-semibold text-green-600">DO &middot; Nên làm</h3>
          <ul className="mt-3 space-y-2">
            {DO_RULES.map((rule) => (
              <li key={rule} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-0.5 text-green-500" aria-hidden="true">&#10003;</span>
                {rule}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6">
          <h3 className="font-display text-lg font-semibold text-destructive">DON&apos;T &middot; Tránh làm</h3>
          <ul className="mt-3 space-y-2">
            {DONT_RULES.map((rule) => (
              <li key={rule} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-0.5 text-destructive" aria-hidden="true">&#10007;</span>
                {rule}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
