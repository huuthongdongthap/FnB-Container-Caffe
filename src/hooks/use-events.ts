import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface EventItem {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  tag: string;
  capacity: number;
  registered: number;
  image?: string;
}

interface EventsResponse {
  success: boolean;
  events: EventItem[];
}

export function useEvents() {
  return useQuery<EventItem[]>({
    queryKey: ['events'],
    queryFn: async () => {
      // Events use pretix proxy via worker
      const res = await apiFetch<EventsResponse>('/api/events');
      return res.events;
    },
  });
}

export function useUpcomingEvents() {
  const { data: events, ...rest } = useEvents();
  const now = new Date().toISOString();
  const upcoming = (events ?? []).filter((e) => e.date >= now);
  const past = (events ?? []).filter((e) => e.date < now);
  return { upcoming, past, ...rest };
}
