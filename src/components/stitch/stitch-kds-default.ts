/**
 * StitchKDSNew — Default data and filter configuration
 *
 * Contains filter tabs and default ticket data for the Kitchen Display System.
 */

import type { Ticket, FilterTab } from './stitch-kds-types';

/** Filter tabs for the top navigation bar */
export const FILTERS: FilterTab[] = [
  { key: 'all', tKey: 'kds.all', label: 'ALL' },
  { key: 'priority', tKey: 'kds.priority', label: 'PRIORITY' },
  { key: 'preparing', tKey: 'kds.preparing', label: 'PREPARING' },
  { key: 'ready', tKey: 'kds.ready', label: 'READY' },
];

/** Default demo tickets for the KDS display */
export const DEFAULT_TICKETS: Ticket[] = [
  {
    id: '#9842', table: 'TABLE B01', type: 'DINE IN', status: 'preparing',
    items: [
      { name: 'Midnight Espresso', quantity: 2, modifier: 'Oat Milk' },
      { name: 'Smoked Truffle Croissant', quantity: 1 },
    ],
    elapsedSeconds: 525,
  },
  {
    id: '#9843', table: 'TABLE B05', type: 'TOGO', status: 'pending',
    items: [
      { name: 'Nitro Tonic', quantity: 1 },
      { name: 'Ceremonial Matcha', quantity: 1, modifier: 'Extra Oat Milk' },
    ],
    elapsedSeconds: 130,
  },
  {
    id: '#9841', table: 'TABLE B12', type: 'DINE IN', status: 'ready',
    items: [
      { name: 'Chrome Velvet Latte', quantity: 3 },
      { name: 'Bronze Chai', quantity: 2 },
    ],
    elapsedSeconds: 750,
    totalTimeSeconds: 750,
  },
  {
    id: '#9844', table: 'TABLE B02', type: 'TOGO', status: 'pending',
    items: [
      { name: 'Industrial Cold Brew', quantity: 1 },
    ],
    elapsedSeconds: 45,
  },
  {
    id: '#9838', table: 'TABLE B09', type: 'DELIVERY', status: 'overdue',
    items: [
      { name: 'Double Smoked Cortado', quantity: 4 },
    ],
    elapsedSeconds: 1092,
  },
];
