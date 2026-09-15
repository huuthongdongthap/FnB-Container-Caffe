export interface CafeTable {
  id: string;
  table_number: number;
  zone: string;
  capacity: number;
  status: 'Available' | 'Occupied' | 'Reserved' | 'Overdue';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface QrCodeRow {
  table_id: number;
  slug: string;
}
