export const NAV_ITEMS = [
  { label: 'Dashboard', icon: '📊', active: true },
  { label: 'Operations', icon: '⚙️', active: false },
  { label: 'Inventory', icon: '📦', active: false },
  { label: 'Staffing', icon: '👥', active: false },
  { label: 'Financials', icon: '💰', active: false },
  { label: 'Settings', icon: '🛠️', active: false },
] as const;

export const ANALYTICS_CARDS = [
  { label: 'TOTAL REVENUE', value: '$42,850.00', change: '+12%', trendUp: true },
  { label: 'ACTIVE ORDERS', value: '156', change: null, trendUp: null },
  { label: 'NEW CUSTOMERS', value: '1,204', change: null, trendUp: null },
  { label: 'AVG. ORDER VALUE', value: '$28.50', change: null, trendUp: null },
] as const;
