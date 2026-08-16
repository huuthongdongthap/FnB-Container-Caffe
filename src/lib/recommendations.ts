/**
 * Simple client-side recommendation engine.
 * Uses order history to suggest items via co-occurrence:
 * "Customers who ordered X also ordered Y".
 *
 * Falls back to popular items when history is insufficient.
 */

export interface RecommendationItem {
  id: string;
  name: string;
  price: number;
  image?: string;
  reason: string; // e.g. "Bạn hay đặt cùng Cà phê sữa"
}

interface OrderHistoryItem {
  id: string;
  name: string;
  quantity: number;
}

/**
 * Build a co-occurrence map from order history.
 * For each item, track which other items appeared in the same order.
 */
function buildCoOccurrence(orders: OrderHistoryItem[][]): Map<string, Map<string, number>> {
  const coMap = new Map<string, Map<string, number>>();

  for (const order of orders) {
    const ids = order.map((i) => i.id);
    for (const item of order) {
      if (!coMap.has(item.id)) coMap.set(item.id, new Map());
      const neighbors = coMap.get(item.id)!;
      for (const other of order) {
        if (other.id !== item.id) {
          neighbors.set(other.id, (neighbors.get(other.id) ?? 0) + 1);
        }
      }
    }
  }

  return coMap;
}

/**
 * Get personalized recommendations based on order history.
 * @param orderHistory - array of past orders, each order is an array of items
 * @param currentMenuItems - available menu items to recommend from
 * @param excludeIds - item IDs to exclude (already in cart or on current view)
 * @param maxResults - max recommendations to return
 */
export function getRecommendations(
  orderHistory: OrderHistoryItem[][],
  currentMenuItems: Array<{ id: string; name: string; price: number; image?: string }>,
  excludeIds: Set<string>,
  maxResults: number = 6,
): RecommendationItem[] {
  if (orderHistory.length === 0 || currentMenuItems.length === 0) return [];

  const coMap = buildCoOccurrence(orderHistory);
  const menuMap = new Map(currentMenuItems.map((i) => [i.id, i]));

  // Score each available menu item
  const scores: Array<{ id: string; score: number; reason: string }> = [];

  for (const item of currentMenuItems) {
    if (excludeIds.has(item.id)) continue;

    let totalScore = 0;
    let topNeighbor = '';
    let topCount = 0;

    // Check how often this item co-occurs with items the user has ordered
    for (const [orderedId, neighbors] of coMap) {
      if (orderedId === item.id) continue;
      const count = neighbors.get(item.id) ?? 0;
      if (count > 0) {
        totalScore += count;
        const orderedItem = menuMap.get(orderedId);
        if (orderedItem && count > topCount) {
          topCount = count;
          topNeighbor = orderedItem.name;
        }
      }
    }

    if (totalScore > 0) {
      const reason = topNeighbor
        ? `Bạn hay đặt cùng ${topNeighbor}`
        : 'Dựa trên lịch sử đặt hàng';
      scores.push({ id: item.id, score: totalScore, reason });
    }
  }

  // Sort by score descending, take top N
  scores.sort((a, b) => b.score - a.score);

  return scores.slice(0, maxResults).map((s) => {
    const item = menuMap.get(s.id)!;
    return {
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      reason: s.reason,
    };
  });
}

/**
 * Simple "popular items" fallback when no order history is available.
 * Returns items tagged as 'featured' or the first N items.
 */
export function getPopularItems(
  currentMenuItems: Array<{ id: string; name: string; price: number; image?: string; tags?: string[] }>,
  excludeIds: Set<string>,
  maxResults: number = 6,
): RecommendationItem[] {
  const featured = currentMenuItems
    .filter((i) => !excludeIds.has(i.id) && i.tags?.includes('featured'))
    .slice(0, maxResults);

  if (featured.length >= maxResults) {
    return featured.map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      image: i.image,
      reason: 'Món phổ biến',
    }));
  }

  // Fill remaining with first available items
  const remaining = currentMenuItems
    .filter((i) => !excludeIds.has(i.id) && !featured.some((f) => f.id === i.id))
    .slice(0, maxResults - featured.length);

  return [...featured, ...remaining].map((i) => ({
    id: i.id,
    name: i.name,
    price: i.price,
    image: i.image,
    reason: i.tags?.includes('featured') ? 'Món phổ biến' : 'Có thể bạn thích',
  }));
}
