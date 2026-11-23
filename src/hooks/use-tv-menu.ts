import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useClientSessionScope } from '@/lib/client-session';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  category_name?: string;
  categoryName?: string;
  available: boolean;
  image?: string;
}

export interface MenuGroup {
  category: string;
  items: MenuItem[];
}

export interface HappyHourInfo {
  active: boolean;
  name?: string;
  discountPercent?: number;
  startTime?: string;
  endTime?: string;
}

export interface TVMenuResult {
  menuGroups: MenuGroup[];
  totalItems: number;
  isLoading: boolean;
  isError: boolean;
  lastUpdated: Date | null;
  isHappyHour: boolean;
  happyHour: HappyHourInfo;
}

interface MenuApiResponse {
  items?: MenuItem[];
  success?: boolean;
  data?: {
    items?: MenuItem[];
    categories?: Array<{ name?: string; items?: MenuItem[] }>;
  };
}

interface HappyHourWindowPayload {
  name?: string;
  discount_rate?: number;
  discount_percent?: number;
  start_time?: string;
  end_time?: string;
}

interface HappyHourApiResponse {
  success?: boolean;
  active?: boolean;
  window?: HappyHourWindowPayload | null;
  data?: HappyHourWindowPayload | null;
}

const REFRESH_INTERVAL = 30_000;
const HAPPY_HOUR_REFRESH_INTERVAL = 60_000;

const CATEGORY_SLUG_LABELS: Record<string, string> = {
  coffee: 'Cà phê',
  tea: 'Trà',
  smoothie: 'Sinh tố',
  juice: 'Nước ép',
  pastry: 'Bánh ngọt',
  bakery: 'Bánh ngọt',
  food: 'Đồ ăn',
  snack: 'Ăn vặt',
  signature: 'Đặc biệt',
  specialty: 'Đặc sản',
  cold: 'Đồ lạnh',
  milk_tea: 'Trà sữa',
  other: 'Khác',
};

export function normalizeHappyHourDiscountPercent(
  win: HappyHourWindowPayload | null | undefined,
): number | undefined {
  if (!win) return undefined;
  const raw =
    typeof win.discount_rate === 'number'
      ? win.discount_rate
      : typeof win.discount_percent === 'number'
        ? win.discount_percent
        : undefined;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return undefined;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
}

export function resolveTvCategoryLabel(item: MenuItem): string {
  const explicit = (item.categoryName || item.category_name || '').trim();
  if (explicit) return explicit;
  const raw = (item.category || '').trim();
  if (!raw) return 'Khác';
  const normalized = raw.toLowerCase().replace(/^cat_/, '');
  return CATEGORY_SLUG_LABELS[normalized] ?? raw;
}

export function useTVMenu(): TVMenuResult {
  const session = useClientSessionScope();

  const {
    data,
    dataUpdatedAt,
    isLoading,
    isError,
  } = useQuery<MenuApiResponse>({
    queryKey: ['tv-menu', session.tenantId],
    queryFn: () =>
      apiFetch<MenuApiResponse>('/api/menu?available=true&limit=200'),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 25_000,
    retry: 3,
  });

  const { data: happyHourData } = useQuery<HappyHourApiResponse>({
    queryKey: ['tv-menu-happy-hour', session.tenantId],
    queryFn: () =>
      apiFetch<HappyHourApiResponse>('/api/menu-modifiers/happy-hour/now'),
    refetchInterval: HAPPY_HOUR_REFRESH_INTERVAL,
    staleTime: 55_000,
    retry: 1,
  });

  const rawItems: MenuItem[] = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.data?.items)
      ? data.data.items
      : Array.isArray(data?.data?.categories)
        ? data.data.categories.flatMap((c) =>
            (c.items || []).map((item) => ({
              ...item,
              category: item.category_name || item.categoryName || c.name || item.category,
            })),
          )
        : [];

  const groups = groupByCategory(rawItems);

  const activeWindow = happyHourData?.active
    ? (happyHourData.window ?? happyHourData.data ?? null)
    : null;
  const discountPercent = normalizeHappyHourDiscountPercent(activeWindow);
  const happyHour: HappyHourInfo = {
    active: Boolean(activeWindow),
    ...(activeWindow?.name ? { name: activeWindow.name } : {}),
    ...(typeof discountPercent === 'number' ? { discountPercent } : {}),
    ...(activeWindow?.start_time ? { startTime: activeWindow.start_time } : {}),
    ...(activeWindow?.end_time ? { endTime: activeWindow.end_time } : {}),
  };

  return {
    menuGroups: groups,
    totalItems: rawItems.length,
    isLoading,
    isError,
    lastUpdated: dataUpdatedAt > 0 ? new Date(dataUpdatedAt) : null,
    isHappyHour: happyHour.active,
    happyHour,
  };
}

function groupByCategory(items: MenuItem[]): MenuGroup[] {
  const map = new Map<string, MenuItem[]>();
  for (const item of items) {
    const cat = resolveTvCategoryLabel(item);
    const existing = map.get(cat);
    if (existing) {
      existing.push(item);
    } else {
      map.set(cat, [item]);
    }
  }
  return Array.from(map.entries())
    .map(([category, groupItems]) => ({ category, items: groupItems }))
    .sort((a, b) => a.category.localeCompare(b.category));
}
