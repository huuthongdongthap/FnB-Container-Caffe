export interface CafeTableRow {
	id: string;
	table_number: number;
	zone: string;
	capacity: number;
	status: 'Available' | 'Occupied' | 'Reserved' | 'Overdue';
	updated_at?: string;
}

export interface OrderRow {
	table_id: string;
	status: string;
}
