export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface ReservationRecord {
  id: string;
  table_id: string;
  customer_name: string;
  customer_phone: string;
  guest_count: number;
  date: string;
  time: string;
  zone: string;
  notes: string | null;
  status: ReservationStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateReservationInput {
  table_id: string;
  customer_name: string;
  customer_phone: string;
  guest_count?: number;
  date: string;
  time: string;
  notes?: string;
}

export interface TableAvailability {
  id: string;
  table_number: number;
  zone: string;
  capacity: number;
  status: string;
  available: boolean;
}
