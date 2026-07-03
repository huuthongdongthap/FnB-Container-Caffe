import { cn } from '@/lib/cn';
import { Check, X } from 'lucide-react';

interface BaziExplanationProps {
  className?: string;
}

const ELEMENTS = [
  {
    element: '壬 Thủy',
    role: 'Nhật chủ (Nguyễn Hữu Còn)',
    meaning: 'Nước Dương — chủ đạo, dòng chảy, cảm xúc sâu.',
    color: 'bg-blue-900',
  },
  {
    element: '庚/辛 Kim',
    role: 'Tỷ Kiếp / Kiêu Thần',
    meaning: 'Kim loại sinh Thủy — chrome, bạc, thép không gỉ.',
    color: 'bg-gray-300',
  },
  {
    element: '乙 Mộc',
    role: 'Thương Quan',
    meaning: 'Cây xanh — forest bar zone, cây leo corten.',
    color: 'bg-[#2D5A3D]',
  },
];

const ALLOWED = [
  'Chrome/Silver #C9D6DF (Kim sinh Thủy)',
  'Navy #0A1A2E (Thủy chủ đạo)',
  'Forest #2D5A3D (Mộc cho bar zone)',
  'Kính, gương, inox, thép tối',
];

const FORBIDDEN = [
  'Gold #FFD700 / #D4AF37 (Thổ khắc Thủy)',
  'Hổ phách đất, nâu (Thổ)',
  'Cam/đỏ rực (Hỏa hao Thủy)',
];

export function BaziExplanation({ className }: BaziExplanationProps) {
  return (
    <section className={cn('space-y-8', className)}>
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">
          Bát Tự Foundation
        </h2>
        <p className="mt-2 text-muted">
          Triết lý phong thủy Bát Tự (Tứ Trụ) làm nền tảng cho toàn bộ nhận diện thương hiệu AURA CAFE.
        </p>
      </div>

      {/* Element cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {ELEMENTS.map((el) => (
          <div
            key={el.element}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <div
              className={cn(
                'mb-3 h-3 w-full rounded-full',
                el.color,
              )}
            />
            <h3 className="font-display text-xl font-semibold text-foreground">
              {el.element}
            </h3>
            <p className="mt-1 text-xs font-medium text-accent">{el.role}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {el.meaning}
            </p>
          </div>
        ))}
      </div>

      {/* Allowed / Forbidden */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6">
          <h3 className="font-display text-lg font-semibold text-green-600">
            <Check size={16} className="inline text-green-500" /> Nên dùng
          </h3>
          <ul className="mt-3 space-y-2">
            {ALLOWED.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-0.5 shrink-0 text-green-500" aria-hidden="true"><Check size={16} className="inline text-green-500" /></span>
                <span dangerouslySetInnerHTML={{
                  __html: item.replace(
                    /(#[\dA-Fa-f]{3,8})/g,
                    '<code class="rounded bg-accent/10 px-1 font-mono text-xs text-accent">$1</code>',
                  ),
                }} />
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6">
          <h3 className="font-display text-lg font-semibold text-destructive">
            <X size={16} className="inline text-destructive" /> Cấm tuyệt đối
          </h3>
          <ul className="mt-3 space-y-2">
            {FORBIDDEN.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-0.5 shrink-0 text-destructive" aria-hidden="true"><X size={16} className="inline text-destructive" /></span>
                <span dangerouslySetInnerHTML={{
                  __html: item.replace(
                    /(#[\dA-Fa-f]{3,8})/g,
                    '<code class="rounded bg-accent/10 px-1 font-mono text-xs text-accent">$1</code>',
                  ),
                }} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
