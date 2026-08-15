export interface StatusStep {
  status: string;
  label: string;
  time?: string;
}

interface OrderBase {
  created_at?: string;
  status?: string;
}

export function getStatusTime(order: OrderBase, status: string): string | undefined {
  // API returns status fields; use created_at as fallback for confirmed
  if (status === 'confirmed') return order.created_at;
  return undefined;
}
