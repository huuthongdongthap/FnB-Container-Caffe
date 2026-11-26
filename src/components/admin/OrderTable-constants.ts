export const STATUS_VARIANT: Record<string, 'warning' | 'info' | 'success' | 'destructive' | 'default'> = {
  pending: 'warning',
  confirmed: 'info',
  preparing: 'info',
  ready: 'success',
  delivering: 'info',
  served: 'success',
  delivered: 'success',
  completed: 'default',
  cancelled: 'destructive',
  failed: 'destructive',
  expired: 'destructive',
};

export const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served', 'delivering'],
  served: ['completed'],
  delivering: ['delivered', 'failed'],
  delivered: ['completed'],
};

export function getStatusTransitionsForOrder(currentStatus: string, orderType?: string): string[] {
  if (currentStatus === 'ready') {
    return orderType === 'delivery' ? ['delivering', 'cancelled'] : ['served', 'cancelled'];
  }
  return STATUS_TRANSITIONS[currentStatus] ?? [];
}
