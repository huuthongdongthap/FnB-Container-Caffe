/**
 * StitchKDSNew — Type definitions
 *
 * Shared types for the Kitchen Display System components.
 */

import type { ReactNode } from 'react';

export type TicketStatus = 'preparing' | 'pending' | 'ready' | 'overdue';

export type KdsFilterKey = 'all' | 'overdue' | 'priority' | 'pending' | 'preparing' | 'ready';

export interface TicketItem {
  name: string;
  quantity: number;
  modifier?: string;
  notes?: string;
}

export interface Ticket {
  id: string;
  table: string;
  type: 'DINE IN' | 'TOGO' | 'DELIVERY';
  status: TicketStatus;
  rawStatus?: string;
  isOverdue?: boolean;
  isWarning?: boolean;
  items: TicketItem[];
  notes?: string;
  elapsedSeconds: number;
  totalTimeSeconds?: number;
}

export interface KdsStationOption {
  id: string;
  label: string;
}

export interface StitchKDSNewProps {
  tickets?: Ticket[];
  stationName?: string;
  stationLabel?: string;
  stationLocation?: string;
  stationLoad?: number;
  avgPrepTime?: string;
  selectedStation?: string;
  stations?: KdsStationOption[];
  onStationChange?: (stationId: string) => void;
  isLoading?: boolean;
  error?: string | null;
  pendingOrders?: Record<string, boolean>;
  mutationErrors?: Record<string, string>;
  onCompleteTicket?: (id: string) => void;
  onStartPrep?: (id: string) => void;
  onPickupOrder?: (id: string) => void;
  onRefresh?: () => void;
  activeFilter?: KdsFilterKey;
  onFilterChange?: (filter: KdsFilterKey) => void;
  soundEnabled?: boolean;
  isFullscreen?: boolean;
  onToggleSound?: () => void;
  onToggleFullscreen?: () => void;
  cancelledBanner?: ReactNode;
}

/** Filter tab configuration */
export interface FilterTab {
  key: KdsFilterKey;
  tKey: string;
  label: string;
}

/** Status badge visual configuration */
export interface StatusBadgeConfig {
  tKey: string;
  bg: string;
  text: string;
  pulse?: boolean;
}
