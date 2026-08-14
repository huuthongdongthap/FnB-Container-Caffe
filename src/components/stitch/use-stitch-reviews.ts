/**
 * StitchReviewsNew — Filter and review list hook
 *
 * Manages active filter state and computes the filtered/sorted review list
 * from the provided page data. Supports All, 5-Star, Photo, and Latest filters.
 */

import { useState, useCallback, useMemo } from 'react';
import type { FilterOption, ReviewsPageData } from './stitch-reviews-new-types';

export function useStitchReviews(data: ReviewsPageData | undefined) {
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');

  const handleFilter = useCallback(
    (filter: FilterOption, onFilterChange?: (f: FilterOption) => void) => {
      setActiveFilter(filter);
      onFilterChange?.(filter);
    },
    [],
  );

  const visibleReviews = useMemo(() => {
    if (!data) return [];
    let items = data.reviews;

    if (activeFilter === '5-star') {
      items = items.filter((r) => r.rating === 5);
    } else if (activeFilter === 'photo') {
      items = items.filter((r) => r.images && r.images.length > 0);
    } else if (activeFilter === 'latest') {
      items = [...items].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    }

    return items;
  }, [data, activeFilter]);

  return { activeFilter, handleFilter, visibleReviews };
}
