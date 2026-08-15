import type { AdminOrder } from '@/hooks/use-admin';

export interface OrderTableProps {
  orders: AdminOrder[];
  statusFilter?: string;
  paymentFilter?: string;
  sortBy?: 'date' | 'total';
  searchQuery?: string;
  className?: string;
  onUpdateStatus?: (orderId: string, status: string) => Promise<void>;
  onRefund?: (payment: { paymentId: string; orderId: string; amount: number; customerName: string }) => void;
}

export interface StatusActionsProps {
  currentStatus: string;
  isUpdating: boolean;
  onUpdate: (status: string) => void;
  t: (key: string) => string;
}

export interface RefundActionProps {
  order: AdminOrder;
  userRole?: string | null;
  onRefund: (payment: { paymentId: string; orderId: string; amount: number; customerName: string }) => void;
  t: (key: string) => string;
}
