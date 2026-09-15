/**
 * Station Policy — unit tests for category-to-station routing logic.
 */
import { describe, test, expect } from 'vitest';
import {
  buildCategoryStationIndex,
  buildIndexFromDbRows,
  parseOrderItems,
  routeItemToStation,
  groupItemsByStation,
  filterItemsForStation,
} from './station-policy';

describe('parseOrderItems', () => {
  test('parses valid JSON array', () => {
    const items = '[{"name":"Latte","qty":2,"category_id":"coffee"}]';
    const result = parseOrderItems(items);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Latte');
  });

  test('returns empty for null/empty', () => {
    expect(parseOrderItems(null)).toEqual([]);
    expect(parseOrderItems('')).toEqual([]);
    expect(parseOrderItems(undefined)).toEqual([]);
  });

  test('returns empty for malformed JSON', () => {
    expect(parseOrderItems('{bad')).toEqual([]);
  });

  test('returns empty for non-array JSON', () => {
    expect(parseOrderItems('{"a":1}')).toEqual([]);
  });
});

describe('buildCategoryStationIndex', () => {
  test('maps category_id to station_id', () => {
    const index = buildCategoryStationIndex([
      { category_id: 'cat-coffee', station_id: 'KS-COFFEE', station_name: 'Coffee' },
      { category_id: 'cat-food', station_id: 'KS-FOOD', station_name: 'Food' },
    ]);
    expect(index.get('cat-coffee')?.station_id).toBe('KS-COFFEE');
    expect(index.get('cat-food')?.station_id).toBe('KS-FOOD');
  });
});

describe('buildIndexFromDbRows', () => {
  test('handles snake_case + PascalCase columns', () => {
    const index = buildIndexFromDbRows([
      { category_id: 'a', station_id: 's1', station_name: 'A' },
      { categoryId: 'b', stationId: 's2', stationName: 'B' },
    ]);
    expect(index.get('a')?.station_id).toBe('s1');
    expect(index.get('b')?.station_id).toBe('s2');
  });

  test('skips rows missing category_id or station_id', () => {
    const index = buildIndexFromDbRows([
      { category_id: '', station_id: 's1' },
      { category_id: 'a', station_id: '' },
      { category_id: 'b', station_id: 's2' },
    ]);
    expect(index.size).toBe(1);
    expect(index.get('b')).toEqual({ station_id: 's2', station_name: null });
  });
});

describe('routeItemToStation', () => {
  const index = buildCategoryStationIndex([
    { category_id: 'coffee', station_id: 'KS-COFFEE', station_name: 'Coffee' },
    { category_id: 'food', station_id: 'KS-FOOD', station_name: 'Food' },
  ]);

  test('routes matching category', () => {
    const routed = routeItemToStation(
      { name: 'Latte', category_id: 'coffee' },
      index,
    );
    expect(routed.station_id).toBe('KS-COFFEE');
  });

  test('returns null for unmapped category', () => {
    const routed = routeItemToStation(
      { name: 'Mystery', category_id: 'unmapped' },
      index,
    );
    expect(routed.station_id).toBeNull();
  });

  test('reads PascalCase categoryId fallback', () => {
    const routed = routeItemToStation(
      { name: 'Pizza', categoryId: 'food' },
      index,
    );
    expect(routed.station_id).toBe('KS-FOOD');
  });
});

describe('groupItemsByStation', () => {
  const index = buildCategoryStationIndex([
    { category_id: 'coffee', station_id: 'KS-COFFEE', station_name: 'Coffee' },
    { category_id: 'food', station_id: 'KS-FOOD', station_name: 'Food' },
  ]);

  test('groups items by station, skipping unmapped', () => {
    const orders = [
      { id: 'o1', items: '[{"name":"Latte","category_id":"coffee"},{"name":"Pizza","category_id":"food"}]' },
      { id: 'o2', items: '[{"name":"Cappuccino","category_id":"coffee"}]' },
      { id: 'o3', items: '[{"name":"Unknown","category_id":"mystery"}]' },
    ];
    const groups = groupItemsByStation(orders, index);
    expect(groups.get('KS-COFFEE')).toBeDefined();
    expect(groups.get('KS-FOOD')).toBeDefined();
    expect(groups.get('KS-COFFEE')!.items).toHaveLength(2);
    expect(groups.get('KS-FOOD')!.items).toHaveLength(1);
  });

  test('returns empty map for no matches', () => {
    const orders = [{ id: 'o1', items: '[{"name":"X","category_id":"none"}]' }];
    const groups = groupItemsByStation(orders, index);
    expect(groups.size).toBe(0);
  });
});

describe('filterItemsForStation', () => {
  const index = buildCategoryStationIndex([
    { category_id: 'coffee', station_id: 'KS-COFFEE', station_name: 'Coffee' },
    { category_id: 'food', station_id: 'KS-FOOD', station_name: 'Food' },
  ]);

  test('returns only items for the given station', () => {
    const itemsJson = '[{"name":"Latte","category_id":"coffee"},{"name":"Pizza","category_id":"food"},{"name":"Cronut","category_id":"coffee"}]';
    const coffeeItems = filterItemsForStation(itemsJson, 'KS-COFFEE', index);
    expect(coffeeItems).toHaveLength(2);
    expect(coffeeItems[0].name).toBe('Latte');
    expect(coffeeItems[1].name).toBe('Cronut');
  });

  test('returns empty when station has no items', () => {
    const itemsJson = '[{"name":"Latte","category_id":"coffee"}]';
    const result = filterItemsForStation(itemsJson, 'KS-FOOD', index);
    expect(result).toEqual([]);
  });
});
