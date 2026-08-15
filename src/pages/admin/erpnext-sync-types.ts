export interface SyncLogEntry {
  id: string;
  entity: string;
  action: string;
  status: 'success' | 'error';
  message: string;
  timestamp: string;
}

export const SYNC_ENTITIES = ['Orders', 'Products', 'Customers', 'Inventory', 'Invoices'] as const;
