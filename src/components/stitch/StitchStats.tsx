export interface StitchStatsProps {
  className?: string;
}

interface StatItem {
  value: string;
  label: string;
}

const brandStats: StatItem[] = [
  { value: '5', label: 'Khu Vuc' },
  { value: '100%', label: 'Cafe Nguyen Chat' },
  { value: '360°', label: 'Tam Nhin' },
  { value: '30+', label: 'Cho Ngoi' },
];

export default function StitchStats({ className = '' }: Readonly<StitchStatsProps>) {
  return (
    <section className={'relative z-30 -mt-16 px-[24px] max-w-[1280px] mx-auto ' + className}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
        {brandStats.map((stat) => (
          <div
            key={stat.label}
            className="backdrop-blur-md bg-[#0A1A2E]/60 border border-[#b8c7e2]/20 p-8 text-center"
            style={{
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)',
            }}
          >
            <p className="font-['EB_Garamond',serif] text-[clamp(2.5rem,6vw,3rem)] text-[#b8c7e2] mb-2 leading-[1.2] tracking-[-0.01em] font-medium">
              {stat.value}
            </p>
            <p className="text-sm tracking-[0.1em] uppercase text-[#c5c6cd] font-['Space_Grotesk',sans-serif] font-semibold">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
