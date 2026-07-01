import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useEffect, useState } from 'react';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
  image?: string;
}

export interface MenuGroup {
  category: string;
  items: MenuItem[];
}

export interface TVMenuResult {
  menuGroups: MenuGroup[];
  totalItems: number;
  isLoading: boolean;
  isError: boolean;
  lastUpdated: Date | null;
  isHappyHour: boolean;
}

const REFRESH_INTERVAL = 30_000;

function checkHappyHour(): boolean {
  const now = new Date();
  const hours = now.getHours();
  return hours >= 14 && hours < 16;
}

export function useTVMenu(): TVMenuResult {
  const [isHappyHour, setIsHappyHour] = useState(checkHappyHour);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsHappyHour(checkHappyHour());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const {
    data,
    isLoading,
    isError,
  } = useQuery<{ items: MenuItem[]; success: boolean }>({
    queryKey: ['tv-menu'],
    queryFn: () =>
      apiFetch<{ items: MenuItem[]; success: boolean }>('/api/menu?available=true&limit=50'),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 25_000,
    retry: 3,
  });

  const groups = groupByCategory(data?.items ?? []);

  return {
    menuGroups: groups,
    totalItems: data?.items?.length ?? 0,
    isLoading,
    isError,
    lastUpdated: data ? new Date() : null,
    isHappyHour,
  };
}

function groupByCategory(items: MenuItem[]): MenuGroup[] {
  const map = new Map<string, MenuItem[]>();
  for (const item of items) {
    const cat = item.category || 'Khác';
    const existing = map.get(cat);
    if (existing) {
      existing.push(item);
    } else {
      map.set(cat, [item]);
    }
  }
  return Array.from(map.entries())
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => a.category.localeCompare(b.category));
}
