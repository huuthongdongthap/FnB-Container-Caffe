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

interface PretixEvent {
  slug?: string;
  name?: Record<string, string> | string;
  date_from?: string;
  location?: { name?: string } | string;
  capacity?: number;
}

interface PretixEventsResponse {
  success: boolean;
  data?: PretixEvent[];
}

/** Adapter: pretix event shape → EventItem (best-effort, missing fields → defaults). */
function toEventItem(raw: PretixEvent, idx: number): EventItem {
  let title = '';
  if (typeof raw.name === 'string') {
    title = raw.name;
  } else if (raw.name && typeof raw.name === 'object') {
    title = raw.name.vi || raw.name.en || Object.values(raw.name)[0] || '';
  }
  let location = '';
  if (typeof raw.location === 'string') {
    location = raw.location;
  } else if (raw.location && typeof raw.location === 'object') {
    location = raw.location.name || '';
  }
  const date = raw.date_from ? raw.date_from.slice(0, 10) : '';
  return {
    id: raw.slug || `event-${idx}`,
    title,
    description: '',
    date,
    time: '',
    location,
    tag: '',
    capacity: raw.capacity ?? 0,
    registered: 0,
  };
}

export function useEvents() {
  return useQuery<EventItem[]>({
    queryKey: ['events'],
    queryFn: async () => {
      try {
        const res = await apiFetch<PretixEventsResponse>('/api/pretix/events');
        const items = Array.isArray(res?.data)
          ? res.data.map((e, i) => toEventItem(e, i)).filter((it) => it.title)
          : [];
        return items;
      } catch {
        // Pretix not configured or unreachable → render defaultData demo in page
        return [];
      }
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
