export type TicketStatus = 'preparing' | 'pending' | 'ready' | 'cancelled';

export interface TicketItem {
  qty: string;
  name: string;
  modifier?: string;
  isCompleted?: boolean;
}

export interface Ticket {
  id: string;
  status: TicketStatus;
  table: string;
  serviceType: string;
  timerText: string;
  timerLabel: string;
  isOverdue?: boolean;
  items: TicketItem[];
  actionLabel: string;
  actionDisabled?: boolean;
}

export interface NavItem {
  label: string;
  icon: string;
  active?: boolean;
}
