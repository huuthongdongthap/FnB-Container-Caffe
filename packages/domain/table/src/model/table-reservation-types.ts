/**
 * Canonical Table & Reservation Domain Types
 * Flow: TABLE → RESERVATION → SEATING → ORDER → CHECKOUT → TABLE RELEASE
 */

export type TablePhysicalStatus = 'Available' | 'Reserved' | 'Occupied' | 'Overdue';
export type ReservationLifecycleStatus = 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';

export interface CanonicalTable {
  id: string;
  table_number: string | number;
  capacity: number;
  zone: string;
  status: TablePhysicalStatus;
  operating_unit_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CanonicalReservation {
  id: string;
  table_id: string;
  customer_name: string;
  customer_phone: string;
  guest_count: number;
  date: string;
  time: string;
  zone: string;
  status: ReservationLifecycleStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReservationPolicyInput {
  tableId: string;
  customerName: string;
  customerPhone: string;
  guestCount?: number;
  date: string;
  time: string;
  zone?: string;
  notes?: string;
  operatingUnitId?: string;
}

export interface SeatTableInput {
  tableId: string;
  reservationId?: string;
  customerName?: string;
  customerPhone?: string;
  guestCount?: number;
  operatingUnitId?: string;
}

export interface ReleaseTableInput {
  tableId: string;
  reservationId?: string;
  notes?: string;
  operatingUnitId?: string;
}

export interface AvailabilityQuery {
  date: string;
  time?: string;
  zone?: string;
  guestCount?: number;
  operatingUnitId?: string;
}
