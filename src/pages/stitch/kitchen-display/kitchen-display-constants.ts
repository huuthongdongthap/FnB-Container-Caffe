import type { Ticket } from './kitchen-display-types';

export const STATUS_TABS = ['ALL', 'PRIORITY', 'PREPARING', 'READY'] as const;

export const NAV_ITEMS = [
  { label: 'DASHBOARD', icon: '📊', active: true },
  { label: 'HISTORY', icon: '📋', active: false },
  { label: 'INVENTORY', icon: '📦', active: false },
  { label: 'STAFF', icon: '👥', active: false },
] as const;

export const TICKETS: Ticket[] = [
  {
    id: '9842',
    status: 'preparing',
    table: 'TABLE B01',
    serviceType: 'DINE IN',
    timerText: '08:45',
    timerLabel: 'ELAPSED',
    items: [
      { qty: '2x', name: 'Midnight Espresso', modifier: 'Modifier: Oat Milk' },
      { qty: '1x', name: 'Smoked Truffle Croissant' },
    ],
    actionLabel: 'COMPLETE TICKET',
  },
  {
    id: '9843',
    status: 'pending',
    table: 'TABLE B05',
    serviceType: 'TOGO',
    timerText: '02:10',
    timerLabel: 'ELAPSED',
    items: [
      { qty: '1x', name: 'Nitro Tonic' },
      { qty: '1x', name: 'Ceremonial Matcha', modifier: 'EXTRA OAT MILK' },
    ],
    actionLabel: 'START PREP',
  },
  {
    id: '9841',
    status: 'ready',
    table: 'TABLE B12',
    serviceType: 'DINE IN',
    timerText: '12:30',
    timerLabel: 'TOTAL TIME',
    isOverdue: false,
    items: [
      { qty: '3x', name: 'Chrome Velvet Latte', isCompleted: true },
      { qty: '2x', name: 'Bronze Chai', isCompleted: true },
    ],
    actionLabel: 'ORDER PICKED UP',
    actionDisabled: true,
  },
  {
    id: '9844',
    status: 'pending',
    table: 'TABLE B02',
    serviceType: 'TOGO',
    timerText: '00:45',
    timerLabel: 'ELAPSED',
    items: [{ qty: '1x', name: 'Industrial Cold Brew' }],
    actionLabel: 'START PREP',
  },
  {
    id: '9838',
    status: 'preparing',
    table: 'TABLE B09',
    serviceType: 'DELIVERY',
    timerText: '18:12',
    timerLabel: 'OVERDUE',
    isOverdue: true,
    items: [{ qty: '4x', name: 'Double Smoked Cortado' }],
    actionLabel: 'PRIORITY COMPLETE',
  },
];
