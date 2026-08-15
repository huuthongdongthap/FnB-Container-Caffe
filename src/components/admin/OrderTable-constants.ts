export const STATUS_VARIANT: Record<string, 'warning' | 'info' | 'success' | 'destructive'> = {
  pending: 'warning',
  confirmed: 'info',
  preparing: 'info',
  ready: 'success',
  delivering: 'info',
  delivered: 'success',
  cancelled: 'destructive',
};

export const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivering'],
  delivering: ['delivered'],
};
