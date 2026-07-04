'use client';

import { useState, useEffect, useCallback } from 'react';

export interface StitchTestimonialsProps {
  className?: string;
}

interface TestimonialItem {
  text: string;
  author: string;
}

const mockData: TestimonialItem[] = [
  {
    text: '"Khong gian tinh te nhat Sa Dec. Su tuong phan giua kim loai cong nghiep va ca phe cao cap that su ngoat muc."',
    author: 'Minh Khoi, Nha Thiet Ke Noi That',
  },
  {
    text: '"Aura Cafe mang den mot dang cap quoc te ma truoc day thieu vang. Crystal Cold Brew cua ho la mot kiet tac."',
    author: 'Lan Anh, Food Blogger',
  },
  {
    text: '"Moi goc la mot buc anh cho san. Kien truc container duoc xu ly voi su thanh lich dang kinh ngac."',
    author: 'Thanh Son, Nhiep Anh Gia',
  },
];

export default function StitchTestimonials({
  className = '',
}: Readonly<StitchTestimonialsProps>) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(false);

  const goTo = useCallback(
    (index: number) => {
      setFade(true);
      setTimeout(() => {
        setCurrentIndex(index);
        setFade(false);
      }, 300);
    },
    [],
  );

  const next = useCallback(() => {
    const nextIndex = (currentIndex + 1) % mockData.length;
    goTo(nextIndex);
  }, [currentIndex, goTo]);

  const prev = useCallback(() => {
    const prevIndex = (currentIndex - 1 + mockData.length) % mockData.length;
    goTo(prevIndex);
  }, [currentIndex, goTo]);

  useEffect(() => {
    const interval = setInterval(() => {
      next();
    }, 5000);
    return () => clearInterval(interval);
  }, [next]);

  const current = mockData[currentIndex]!;

  return (
    <section className={'py-[120px] overflow-hidden relative ' + className}>
      <div className="max-w-4xl mx-auto px-[24px] text-center relative z-10">
        {/* Quote icon */}
        <svg
          className="mx-auto w-16 h-16 text-[var(--aura-chrome-light)]/30 mb-8"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
        </svg>

        <div className="min-h-[250px] flex flex-col justify-center">
          <div
            className={
              'transition-all duration-300 ' +
              (fade ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0')
            }
          >
            <p className="font-display text-[clamp(1.5rem,4vw,2.5rem)] italic mb-10 leading-snug text-[var(--aura-text-primary)]">
              {current.text}
            </p>
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-px bg-[var(--aura-chrome-light)]" />
              <p className="text-sm tracking-[0.1em] text-[var(--aura-chrome-light)] uppercase font-['Space_Grotesk',sans-serif] font-semibold">
                {current.author}
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 mt-16">
          <button
            onClick={prev}
            className="w-10 h-10 rounded-full border border-[var(--aura-border-soft)] flex items-center justify-center hover:bg-[var(--aura-chrome-light)] hover:text-black transition-all"
            aria-label="Truoc"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={next}
            className="w-10 h-10 rounded-full border border-[var(--aura-border-soft)] flex items-center justify-center hover:bg-[var(--aura-chrome-light)] hover:text-black transition-all"
            aria-label="Tiep"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
