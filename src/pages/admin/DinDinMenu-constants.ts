import type { DinDinItem } from './DinDinMenu-types';

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

export const EMPTY_ITEM: DinDinItem = {
  name: '',
  price: 0,
  description: '',
  available: true,
  modifiers: [],
};
