export interface CafeTableRow {
	id: string;
	table_number: number | string;
	zone: string;
	capacity: number;
	status: 'Available' | 'Occupied' | 'Reserved' | 'Overdue';
	is_active?: number | boolean | null;
	current_session_id?: string | null;
	tenant_id?: string | null;
	updated_at?: string;
}

export interface OrderRow {
	table_id: string;
	status: string;
}

export interface TableSessionRow {
	id: string;
	table_id: string;
	status: string;
	guest_count?: number | null;
	covers?: number | null;
}

export interface TableTransferFeedback {
	kind: 'success' | 'error';
	message: string;
}
