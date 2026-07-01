import { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Testimonial {
  id: string;
  name: string;
  avatar: string;
  text: string;
  rating: number;
  date: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: '1',
    name: 'Nguyễn Minh Anh',
    avatar: '🌟',
    text: 'Không gian rooftop cực chill, nhìn xuống phố Sa Đéc về đêm rất đẹp. Cà phê specialty ngon, nhân viên thân thiện. Sẽ quay lại nhiều lần!',
    rating: 5,
    date: 'Tháng 6, 2026',
  },
  {
    id: '2',
    name: 'Trần Lệ Hằng',
    avatar: '🌟',
    text: 'Lần đầu đến quán container, ấn tượng với thiết kế độc đáo. Jade Counter mộc mạc nhưng sang trọng. Cold Brew ở đây tuyệt vời!',
    rating: 5,
    date: 'Tháng 5, 2026',
  },
  {
    id: '3',
    name: 'Phạm Quốc Bảo',
    avatar: '🌟',
    text: 'Địa điểm check-in sống ảo cực chất ở Sa Đéc. Góc Aura Lounge hoàng hôn đẹp không tưởng. Đồ uống ngon, giá hợp lý.',
    rating: 4,
    date: 'Tháng 4, 2026',
  },
  {
    id: '4',
    name: 'Lê Thị Mai',
    avatar: '🌟',
    text: 'Team building ở Sky Deck rất thoải mái, view đẹp, không gian rộng. Đặt tiệc nhẹ ở đây cũng tiện. Sẽ recommend bạn bè!',
    rating: 5,
    date: 'Tháng 3, 2026',
  },
];

export function TestimonialCarousel() {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % TESTIMONIALS.length);
  }, []);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  }, []);

  // Auto-rotate every 5 seconds
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [isPaused, next]);

  if (TESTIMONIALS.length === 0) return null;

  const testimonial = TESTIMONIALS[current] as Testimonial;

  return (
    <section className="bg-gradient-to-b from-[#0A1A2E] to-[#050D1A] py-20" aria-label="Cảm nhận khách hàng">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-10 text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-chrome-mid/60">
            KHÁCH HÀNG NÓI GÌ
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold text-chrome-bright sm:text-4xl">
            Cảm Nhận Từ Thực Khách
          </h2>
        </div>

        <div
          className="relative"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Testimonial card */}
          <div className="animate-fade-in-up rounded-2xl border border-chrome-light/10 bg-gradient-to-br from-[#0A1A2E]/80 to-[#050D1A]/90 p-8 text-center backdrop-blur-sm">
            <div className="mb-4 text-4xl">{testimonial.avatar}</div>

            <div className="mb-4 flex justify-center gap-1" aria-label={`${testimonial.rating} trên 5 sao`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'h-4 w-4',
                    i < testimonial.rating
                      ? 'fill-chrome-light text-chrome-light'
                      : 'text-chrome-light/20',
                  )}
                />
              ))}
            </div>

            <blockquote className="mb-6 text-lg leading-relaxed text-chrome-light/80 italic">
              &ldquo;{testimonial.text}&rdquo;
            </blockquote>

            <div>
              <p className="font-semibold text-chrome-bright">{testimonial.name}</p>
              <p className="mt-1 text-xs text-chrome-mid/60">{testimonial.date}</p>
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              onClick={prev}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-chrome-light/20 text-chrome-light/60 transition-colors hover:border-chrome-light/40 hover:text-chrome-light"
              aria-label="Xem cảm nhận trước"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {/* Dots */}
            <div className="flex gap-2" role="tablist" aria-label="Chọn cảm nhận">
              {TESTIMONIALS.map((_, idx) => (
                <button
                  key={idx}
                  role="tab"
                  aria-selected={idx === current}
                  onClick={() => setCurrent(idx)}
                  className={cn(
                    'h-2 rounded-full transition-all duration-300',
                    idx === current
                      ? 'w-8 bg-chrome-light'
                      : 'w-2 bg-chrome-light/20 hover:bg-chrome-light/40',
                  )}
                  aria-label={`Cảm nhận ${idx + 1}`}
                />
              ))}
            </div>

            <button
              onClick={next}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-chrome-light/20 text-chrome-light/60 transition-colors hover:border-chrome-light/40 hover:text-chrome-light"
              aria-label="Xem cảm nhận tiếp theo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
