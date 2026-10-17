import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface TableInfo {
  id: string;
  table_number: string;
  zone: string;
  available: boolean;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface ReservationPayload {
  table_id: string;
  customer_name: string;
  customer_phone: string;
  guest_count: number;
  date: string;
  time: string;
  notes?: string;
}

export type CreateReservationData = ReservationPayload;

export interface ReservationResult {
  success: boolean;
  data?: {
    id: string;
    table_number?: string;
  };
  error?: string;
}

interface ReservationsResult {
  tables: TableInfo[];
  isLoadingTables: boolean;
  availabilityError: Error | null;
  createReservation: (payload: ReservationPayload) => void;
  createReservationAsync: (payload: ReservationPayload) => Promise<ReservationResult>;
  isCreating: boolean;
  createError: Error | null;
  refetchAvailability: () => void;
}

export function useReservations(date: string, time: string): ReservationsResult {
  const queryClient = useQueryClient();

  const {
    data: tables = [],
    isLoading: isLoadingTables,
    error: availabilityError,
    refetch: refetchAvailability,
  } = useQuery<TableInfo[]>({
    queryKey: ['reservations-availability', date, time],
    queryFn: async () => {
      const res = await apiFetch<
        TableInfo[] | { success?: boolean; data?: TableInfo[] | { tables?: TableInfo[] }; tables?: TableInfo[] }
      >(
        `/api/reservations/availability?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`
      );
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.data)) return res.data;
      if (res?.data && !Array.isArray(res.data) && Array.isArray(res.data.tables)) return res.data.tables;
      if (Array.isArray(res?.tables)) return res.tables;
      return [];
    },
    enabled: !!date && !!time,
    staleTime: 30_000,
    retry: 2,
  });

  const createMutation = useMutation({
    mutationFn: (payload: ReservationPayload) =>
      apiFetch<ReservationResult>('/api/reservations', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations-availability'] });
    },
  });

  return {
    tables,
    isLoadingTables,
    availabilityError: availabilityError as Error | null,
    createReservation: (payload: ReservationPayload) => createMutation.mutate(payload),
    createReservationAsync: (payload: ReservationPayload) => createMutation.mutateAsync(payload),
    isCreating: createMutation.isPending,
    createError: createMutation.error as Error | null,
    refetchAvailability,
  };
}
