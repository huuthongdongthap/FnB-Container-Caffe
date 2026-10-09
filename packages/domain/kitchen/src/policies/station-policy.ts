/**
 * Station Policy — pure logic for category-to-station routing.
 *
 * Each order item carries an immutable category_id (from the snapshot JSON).
 * The category_stations mapping resolves an item's category to a station.
 * Missing/unmapped categories route to a designated fallback station or null.
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

export function parseOrderItems(itemsJson: string | null | undefined): Record<string, unknown>[] {
  if (!itemsJson) return [];
  try {
    const parsed = JSON.parse(itemsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function routeItemToStation(
  item: Record<string, unknown>,
  categoryIndex: Map<string, { station_id: string; station_name: string | null }>,
  fallback?: { station_id: string; station_name?: string | null },
): RoutedItem {
  const categoryId = (item.category_id ?? item.categoryId ?? '') as string;
  const mapping = categoryIndex.get(categoryId);
  if (mapping) {
    return {
      item,
      station_id: mapping.station_id,
      station_name: mapping.station_name ?? null,
    };
  }
  if (fallback?.station_id) {
    return {
      item,
      station_id: fallback.station_id,
      station_name: fallback.station_name ?? null,
    };
  }
  return {
    item,
    station_id: null,
    station_name: null,
  };
}

export function groupItemsByStation(
  orders: Array<{ id: string; items: string | null }>,
  categoryIndex: Map<string, { station_id: string; station_name: string | null }>,
  fallback?: { station_id: string; station_name?: string | null },
): Map<string, StationGroup> {
  const groups = new Map<string, StationGroup>();
  for (const order of orders) {
    const items = parseOrderItems(order.items);
    for (const item of items) {
      const routed = routeItemToStation(item, categoryIndex, fallback);
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

export function filterItemsForStation(
  itemsJson: string | null | undefined,
  stationId: string,
  categoryIndex: Map<string, { station_id: string; station_name: string | null }>,
  isFallbackStation?: boolean,
): Record<string, unknown>[] {
  const items = parseOrderItems(itemsJson);
  return items.filter((item) => {
    const categoryId = (item.category_id ?? item.categoryId ?? '') as string;
    const mapping = categoryIndex.get(categoryId);
    if (mapping) {
      return mapping.station_id === stationId;
    }
    return Boolean(isFallbackStation);
  });
}

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
