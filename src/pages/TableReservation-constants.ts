export const TIME_SLOTS = [
  { time: '07:00' }, { time: '08:00' }, { time: '09:00' }, { time: '10:00' },
  { time: '11:00' }, { time: '14:00' }, { time: '15:00' }, { time: '16:00' },
  { time: '17:00' }, { time: '19:00' }, { time: '20:00' }, { time: '21:00' },
];

export const ZONE_TAB_MAP: Record<string, string> = {
  rooftop: 'VIP',
  cafe: 'Indoor',
  courtyard: 'Outdoor',
};

export function getNextSaturday(): string {
  const d = new Date();
  const diff = 6 - d.getDay();
  d.setDate(d.getDate() + (diff <= 0 ? diff + 7 : diff));
  return d.toISOString().split('T')[0]!;
}

export function formatDateVi(iso: string, t: (key: string) => string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  const days = [
    t('day0'), t('day1'), t('day2'), t('day3'),
    t('day4'), t('day5'), t('day6'),
  ];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${days[d.getDay()]!}, ${dd}/${mm}/${d.getFullYear()}`;
}
