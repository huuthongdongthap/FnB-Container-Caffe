import type { ChefHat } from 'lucide-react';

/** One navigation card in the System Hub grid. */
export interface SectionItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  path: string;
  icon: typeof ChefHat;
  badge: string;
  badgeColor: string;
  primaryAction: string;
}

/** A group of section cards rendered under one heading. */
export interface SectionCategory {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  color: string;
  items: SectionItem[];
}

/**
 * Live counters the catalog reads to build status badges.
 * Passed as counts (not the store objects) so the catalog stays a pure module.
 */
export interface SectionCounts {
  cartItems: number;
  kdsOrders: number;
  adminOrders: number;
  customers: number;
}
