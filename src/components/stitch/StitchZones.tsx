export interface StitchZonesProps {
  className?: string;
}

interface ZoneItem {
  id: string;
  number: string;
  name: string;
  description: string;
  variant: 'glass' | 'primary-container' | 'hover' | 'chrome-gradient';
}

const mockData = {
  sectionLabel: 'Kien Truc Khong Gian',
  sectionTitle: '5 Khong Gian Sang Trong',
  sectionDesc:
    'Moi khong gian duoc thiet ke tinh vi mang den nhung cung bac cam xuc rieng biet, tu nang luong xa hoi den tap trung sau.',
  zones: [
    {
      id: 'jade-counter',
      number: '01',
      name: 'Jade Counter',
      description:
        'Trung tam pha che. Chung kien su chinh xac ky thuat cua nhung barista tai ba trong mot khong gian phong thi nghiem mo.',
      variant: 'glass' as const,
    },
    {
      id: 'sky-deck',
      number: '02',
      name: 'Sky Deck',
      description:
        'Khong gian ngoai troi voi tam nhin cong nghiep, ngam nhi Con tim Sa Dec rong rinh ben duoi.',
      variant: 'primary-container' as const,
    },
    {
      id: 'aura-lounge',
      number: '03',
      name: 'Aura Lounge',
      description: 'Sang trong xa hoi duoc tai dinh nghia voi ghe nhan tong theu va diem nhan chrome.',
      variant: 'hover' as const,
    },
    {
      id: 'vip-steel-nest',
      number: '04',
      name: 'VIP Steel Nest',
      description:
        'Su thoai mai container doc quyen duoc thiet ke cho su rieng tu va tap trung dang cap.',
      variant: 'chrome-gradient' as const,
    },
    {
      id: 'noir-cabin',
      number: '05',
      name: 'Noir Cabin',
      description: 'Goc rieng tu day cam xuc voi anh sang dien anh nhe nhang.',
      variant: 'glass' as const,
    },
  ],
};

function zoneClasses(variant: ZoneItem['variant']): string {
  const base =
    'flex flex-col justify-end group cursor-pointer relative overflow-hidden p-10';
  switch (variant) {
    case 'glass':
      return (
        base +
        ' backdrop-blur-md bg-[#0A1A2E]/60 border border-[#b8c7e2]/20'
      );
    case 'primary-container':
      return (
        base +
        ' border border-[#44474d]/30 bg-[#0a1a2e]'
      );
    case 'hover':
      return (
        base +
        ' border border-[#44474d]/30 hover:bg-[#343536] transition-colors'
      );
    case 'chrome-gradient':
      return (
        base +
        ' bg-gradient-to-br from-[#e0e0e0] via-[#a0a0a0] to-[#c0c0c0]'
      );
    default:
      return base;
  }
}

function zoneTextColor(variant: ZoneItem['variant']): string {
  return variant === 'chrome-gradient' ? 'text-black' : 'text-[#e4e2e4]';
}

function zoneSubtextColor(variant: ZoneItem['variant']): string {
  return variant === 'chrome-gradient' ? 'text-black/80' : 'text-[#c5c6cd]';
}

function zoneLabelColor(variant: ZoneItem['variant']): string {
  return variant === 'chrome-gradient' ? 'text-black/60' : 'text-[#b8c7e2]/60';
}

export default function StitchZones({ className = '' }: Readonly<StitchZonesProps>) {
  return (
    <section className={'bg-[#0e0e10] py-[120px] ' + className}>
      <div className="max-w-[1280px] mx-auto px-[24px]">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
          <div className="max-w-2xl">
            <span className="text-sm tracking-[0.1em] text-[#b8c7e2] uppercase font-['Space_Grotesk',sans-serif] font-semibold mb-4 block">
              {mockData.sectionLabel}
            </span>
            <h2 className="font-['EB_Garamond',serif] text-[clamp(2.5rem,6vw,3rem)] text-[#e4e2e4] leading-tight tracking-[-0.01em] font-medium">
              {mockData.sectionTitle}
            </h2>
          </div>
          <p className="text-lg leading-[1.6] text-[#c5c6cd] max-w-sm opacity-80 font-['Space_Grotesk',sans-serif]">
            {mockData.sectionDesc}
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 md:grid-rows-2 gap-6 h-auto md:h-[800px]">
          {/* Jade Counter — col-span-7 row-span-1 */}
          <div
            className={
              'md:col-span-7 md:row-span-1 ' +
              zoneClasses(mockData.zones[0]!?.variant)
            }
          >
            <div className="absolute inset-0 bg-[#b8c7e2]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <span
              className={
                'text-sm tracking-[0.1em] mb-4 block font-[\'Space_Grotesk\',sans-serif] font-semibold ' +
                zoneLabelColor(mockData.zones[0]!?.variant)
              }
            >
              {mockData.zones[0]!.number}
            </span>
            <h4
              className={
                'font-[\'EB_Garamond\',serif] text-[clamp(2.5rem,6vw,3rem)] mb-4 leading-[1.2] tracking-[-0.01em] font-medium group-hover:translate-x-2 transition-transform duration-500 ' +
                zoneTextColor(mockData.zones[0]!?.variant)
              }
            >
              {mockData.zones[0]!?.name}
            </h4>
            <p
              className={
                'text-base leading-[1.6] max-w-md font-[\'Space_Grotesk\',sans-serif] ' +
                zoneSubtextColor(mockData.zones[0]!?.variant)
              }
            >
              {mockData.zones[0]!?.description}
            </p>
          </div>

          {/* Sky Deck — col-span-5 row-span-1 */}
          <div
            className={
              'md:col-span-5 md:row-span-1 ' +
              zoneClasses(mockData.zones[1]!?.variant)
            }
          >
            <svg
              className="absolute top-10 right-10 text-[#b8c7e2] w-8 h-8 group-hover:rotate-45 transition-transform duration-500 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 7l-10 10m0-10h10v10"
              />
            </svg>
            <span
              className={
                'text-sm tracking-[0.1em] mb-4 block font-[\'Space_Grotesk\',sans-serif] font-semibold ' +
                zoneLabelColor(mockData.zones[1]!?.variant)
              }
            >
              {mockData.zones[1]!.number}
            </span>
            <h4
              className={
                'font-[\'EB_Garamond\',serif] text-[clamp(2.5rem,6vw,3rem)] mb-4 leading-[1.2] tracking-[-0.01em] font-medium ' +
                zoneTextColor(mockData.zones[1]!?.variant)
              }
            >
              {mockData.zones[1]!?.name}
            </h4>
            <p
              className={
                'text-base leading-[1.6] font-[\'Space_Grotesk\',sans-serif] ' +
                zoneSubtextColor(mockData.zones[1]!?.variant)
              }
            >
              {mockData.zones[1]!?.description}
            </p>
          </div>

          {/* Aura Lounge — col-span-4 row-span-1 */}
          <div
            className={
              'md:col-span-4 md:row-span-1 ' +
              zoneClasses(mockData.zones[2]!?.variant)
            }
          >
            <span
              className={
                'text-sm tracking-[0.1em] mb-4 block font-[\'Space_Grotesk\',sans-serif] font-semibold ' +
                zoneLabelColor(mockData.zones[2]!?.variant)
              }
            >
              {mockData.zones[2]!.number}
            </span>
            <h4
              className={
                'font-[\'EB_Garamond\',serif] text-[clamp(1.5rem,3vw,2rem)] mb-4 leading-[1.3] font-medium ' +
                zoneTextColor(mockData.zones[2]!?.variant)
              }
            >
              {mockData.zones[2]!?.name}
            </h4>
            <p
              className={
                'text-base leading-[1.6] font-[\'Space_Grotesk\',sans-serif] ' +
                zoneSubtextColor(mockData.zones[2]!?.variant)
              }
            >
              {mockData.zones[2]!?.description}
            </p>
          </div>

          {/* VIP Steel Nest — col-span-4 row-span-1 */}
          <div
            className={
              'md:col-span-4 md:row-span-1 ' +
              zoneClasses(mockData.zones[3]!?.variant)
            }
          >
            <span
              className={
                'text-sm tracking-[0.1em] mb-4 block font-[\'Space_Grotesk\',sans-serif] font-semibold ' +
                zoneLabelColor(mockData.zones[3]!?.variant)
              }
            >
              {mockData.zones[3]!.number}
            </span>
            <h4
              className={
                'font-[\'EB_Garamond\',serif] text-[clamp(1.5rem,3vw,2rem)] mb-4 leading-[1.3] font-medium ' +
                zoneTextColor(mockData.zones[3]!?.variant)
              }
            >
              {mockData.zones[3]!?.name}
            </h4>
            <p
              className={
                'text-base leading-[1.6] font-[\'Space_Grotesk\',sans-serif] ' +
                zoneSubtextColor(mockData.zones[3]!?.variant)
              }
            >
              {mockData.zones[3]!?.description}
            </p>
          </div>

          {/* Noir Cabin — col-span-4 row-span-1 */}
          <div
            className={
              'md:col-span-4 md:row-span-1 ' +
              zoneClasses(mockData.zones[4]!?.variant)
            }
          >
            <span
              className={
                'text-sm tracking-[0.1em] mb-4 block font-[\'Space_Grotesk\',sans-serif] font-semibold ' +
                zoneLabelColor(mockData.zones[4]!?.variant)
              }
            >
              {mockData.zones[4]!.number}
            </span>
            <h4
              className={
                'font-[\'EB_Garamond\',serif] text-[clamp(1.5rem,3vw,2rem)] mb-4 leading-[1.3] font-medium ' +
                zoneTextColor(mockData.zones[4]!?.variant)
              }
            >
              {mockData.zones[4]!?.name}
            </h4>
            <p
              className={
                'text-base leading-[1.6] font-[\'Space_Grotesk\',sans-serif] ' +
                zoneSubtextColor(mockData.zones[4]!?.variant)
              }
            >
              {mockData.zones[4]!?.description}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
