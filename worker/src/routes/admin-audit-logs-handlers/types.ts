export interface PaginatedResponse<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuditLogRow {
  actor_id: string;
  actor_name: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogQueryParams {
  actorId?: string;
  action?: string;
  resourceType?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

export const CSV_HEADERS = [
  'ID Người dùng / Actor ID',
  'Tên người dùng / Actor Name',
  'Hành động / Action',
  'Loại tài nguyên / Resource Type',
  'ID tài nguyên / Resource ID',
  'Chi tiết / Details',
  'Địa chỉ IP / IP Address',
  'Thời gian / Created At'
] as const;