/**
 * Station Policy — pure logic for category-to-station routing.
 *
 * Each order item carries a category_id (from the items JSON blob). The
 * category_stations mapping resolves an item's category to a station
 * (e.g. "Coffee & Beverages" → "coffee" station, "Food" → "food" station).
 *
 * This module is intentionally free of Hono/worker imports so it can be
 * unit-tested directly under vitest without jsdom or the workers runtime.
 */

export interface StationCategoryMapping {
  category_id: string;
  station_id: string;
  station_name?: string;
  station_slug?: string;
}

export interface RoutedItem {
  item: Record<string, unknown>;
  station_id: string | null;
  station_name: string | null;
}

export interface StationGroup {
  station_id: string;
  station_name: string | null;
  items: Array<{ order_id: string; item: Record<string, unknown> }>;
}

/**
 * Build a lookup from category_id → station mapping rows.
 */
export function buildCategoryStationIndex(
  mappings: StationCategoryMapping[],
): Map<string, { station_id: string; station_name: string | null }> {
  const index = new Map<string, { station_id: string; station_name: string | null }>();
  for (const m of mappings) {
    index.set(m.category_id, {
      station_id: m.station_id,
      station_name: m.station_name ?? null,
    });
  }
  return index;
}

/**
 * Parse an order's items JSON blob into an array of item objects.
 * Returns an empty array for malformed or empty JSON.
 */
export function parseOrderItems(itemsJson: string | null | undefined): Record<string, unknown>[] {
  if (!itemsJson) return [];
  try {
    const parsed = JSON.parse(itemsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Route a single order item to its station based on the category mapping.
 * Returns null station_id when the item's category has no mapped station.
 */
export function routeItemToStation(
  item: Record<string, unknown>,
  categoryIndex: Map<string, { station_id: string; station_name: string | null }>,
): RoutedItem {
  const categoryId = (item.category_id ?? item.categoryId ?? '') as string;
  const mapping = categoryIndex.get(categoryId);
  return {
    item,
    station_id: mapping?.station_id ?? null,
    station_name: mapping?.station_name ?? null,
  };
}

/**
 * Group items from multiple orders by station_id, preserving per-order
 * provenance for the KDS ticket view.
 *
 * Items without a mapped station are omitted (they have no destination).
 */
export function groupItemsByStation(
  orders: Array<{ id: string; items: string | null }>,
  categoryIndex: Map<string, { station_id: string; station_name: string | null }>,
): Map<string, StationGroup> {
  const groups = new Map<string, StationGroup>();
  for (const order of orders) {
    const items = parseOrderItems(order.items);
    for (const item of items) {
      const routed = routeItemToStation(item, categoryIndex);
      if (!routed.station_id) continue;
      if (!groups.has(routed.station_id)) {
        groups.set(routed.station_id, {
          station_id: routed.station_id,
          station_name: routed.station_name,
          items: [],
        });
      }
      groups.get(routed.station_id)!.items.push({ order_id: order.id, item });
    }
  }
  return groups;
}

/**
 * Filter an order's items down to only those belonging to a specific station.
 * Used by the KDS station ticket endpoint so each station sees only its items.
 */
export function filterItemsForStation(
  itemsJson: string | null | undefined,
  stationId: string,
  categoryIndex: Map<string, { station_id: string; station_name: string | null }>,
): Record<string, unknown>[] {
  const items = parseOrderItems(itemsJson);
  return items.filter((item) => {
    const categoryId = (item.category_id ?? item.categoryId ?? '') as string;
    const mapping = categoryIndex.get(categoryId);
    return mapping?.station_id === stationId;
  });
}

/**
 * Resolve an array of mapping rows from the database into the index shape.
 * Accepts both PascalCase (CategoryStation interface) and snake_case (DB row)
 * property names so the same helper works regardless of the query SELECT clause.
 */
export function buildIndexFromDbRows(
  rows: Array<Record<string, unknown>>,
): Map<string, { station_id: string; station_name: string | null }> {
  const index = new Map<string, { station_id: string; station_name: string | null }>();
  for (const row of rows) {
    const categoryId = (row.category_id ?? row.categoryId ?? '') as string;
    const stationId = (row.station_id ?? row.stationId ?? '') as string;
    const stationName = (row.station_name ?? row.stationName ?? null) as string | null;
    if (categoryId && stationId) {
      index.set(categoryId, { station_id: stationId, station_name: stationName });
    }
  }
  return index;
}
