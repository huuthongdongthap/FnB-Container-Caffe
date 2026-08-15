export interface Order {
  id: string;
  customer: string;
  table: string;
  timeAgo: string;
  items: string;
  total: string;
  status: OrderStatus;
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
