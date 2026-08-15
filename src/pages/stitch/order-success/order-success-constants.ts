import type { OrderItem, Step } from './order-success-types';

export const ORDER_ITEMS: readonly OrderItem[] = [
  { qty: 1, name: 'Midnight Espresso', price: '$6.50' },
  { qty: 1, name: 'Chrome Velvet Latte', price: '$7.93' },
] as const;

export const STEPS: readonly Step[] = [
  { label: 'RECEIVED', done: true, active: false },
  { label: 'PREPARING', done: false, active: true },
  { label: 'READY', done: false, active: false },
] as const;

export const ORDER_STYLES = `
  @keyframes shine {
    0% { transform: translateX(-100%) translateY(-100%); }
    100% { transform: translateX(100%) translateY(100%); }
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(1.15); }
  }
  @keyframes ring-spin {
    0% { transform: translate(-50%, -50%) rotate(0deg); }
    100% { transform: translate(-50%, -50%) rotate(360deg); }
  }
  .ring-outer {
    animation: ring-spin 20s linear infinite;
  }
  .ring-inner {
    animation: ring-spin 15s linear infinite reverse;
  }
  .pulse-dot {
    animation: pulse-dot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
`;
