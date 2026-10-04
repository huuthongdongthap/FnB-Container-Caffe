import type { DinDinItem } from './DinDinMenu-types';

export { API_BASE } from '@/lib/api-client';

export const EMPTY_ITEM: DinDinItem = {
  name: '',
  price: 0,
  description: '',
  available: true,
  modifiers: [],
};
