/**
 * Menu Option Rules — decides which customization options apply to a drink.
 *
 * A craft espresso is made to order (sweetness, ice, notes); a bottled soda is
 * not, and asking a customer how much sugar they want in a sealed bottle is
 * noise that slows the order down. So the modal only offers options that are
 * actually adjustable for that drink, derived from its category and serving
 * tags rather than a hand-maintained per-item list — the catalog id is not a
 * stable key between the API rows and the offline fallback data.
 */

import { isReadyToServeItem } from './menu-customization';

export const SWEETNESS_FULL = ['100% đường (chuẩn)', '70% ít ngọt', '50% ngọt thanh', 'Không đường'] as const;
export const SWEETNESS_SODA = ['100% ngọt (chuẩn)', '70% ít ngọt', 'Không đường'] as const;
export const ICE_FULL = ['Đá đầy đủ (chuẩn)', 'Ít đá', 'Đá riêng', 'Uống nóng'] as const;
export const ICE_STANDARD = ['Đá đầy đủ (chuẩn)', 'Ít đá', 'Đá riêng'] as const;
export const ICE_LIGHT = ['Đá thường (chuẩn)', 'Ít đá'] as const;

/** Option groups the customizer can render. */
export interface DrinkOptionPlan {
  /** True when the item needs no formulation at all — caller adds it straight to the cart. */
  bypass: boolean;
  showSweetness: boolean;
  showIce: boolean;
  sweetnessOptions: readonly string[];
  iceOptions: readonly string[];
  showNotes: boolean;
}

interface RuleInput {
  id?: string;
  category?: string;
  name?: string;
  tags?: string[];
}

const hasTag = (tags: string[] | undefined, ...wanted: string[]): boolean => {
  const normalized = (tags ?? []).map((t) => t.trim().toLowerCase());
  return wanted.some((w) => normalized.includes(w.toLowerCase()));
};

/**
 * Blended, bottled, whole-fruit and jarred items have a fixed recipe: sugar and
 * ice are not adjustable. Drinks tagged Hot cannot carry ice either.
 */
const isFixedRecipe = (tags: string[] | undefined): boolean =>
  hasTag(tags, 'blended', 'fresh', 'bottled', 'original');

const isIceAllowed = (tags: string[] | undefined): boolean =>
  !hasTag(tags, 'blended', 'hot', 'bottled', 'original');

interface CategoryRules {
  sweetness: 'full' | 'soda' | null;
  ice: 'full' | 'standard' | 'light' | null;
  notes: boolean;
}

/**
 * Per-category overrides. Tags alone are not enough for `other-drinks`,
 * which spans iced, hot and cold items, so that group is pinned here.
 */
const CATEGORY_RULES: Record<string, CategoryRules> = {
  'traditional-coffee': { sweetness: 'full', ice: 'full', notes: true },
  'hot-coffee': { sweetness: 'full', ice: null, notes: true },
  'frappuccino': { sweetness: null, ice: null, notes: true },
  'smoothies': { sweetness: null, ice: null, notes: true },
  'soda': { sweetness: 'soda', ice: 'light', notes: true },
  'tea': { sweetness: 'full', ice: 'standard', notes: true },
  'yogurt': { sweetness: null, ice: 'light', notes: true },
  'juice': { sweetness: null, ice: 'light', notes: true },
  'other-drinks': { sweetness: 'full', ice: 'standard', notes: true },
  bottled: { sweetness: null, ice: null, notes: false },
};

const OPTION_SETS = {
  full: SWEETNESS_FULL,
  soda: SWEETNESS_SODA,
} as const;

const ICE_SETS = {
  full: ICE_FULL,
  standard: ICE_STANDARD,
  light: ICE_LIGHT,
} as const;

/** Used when there is no item (or no category) to derive a plan from. */
const permissivePlan = (bypass: boolean): DrinkOptionPlan => ({
  bypass,
  showSweetness: true,
  showIce: true,
  sweetnessOptions: SWEETNESS_FULL,
  iceOptions: ICE_FULL,
  showNotes: true,
});

/**
 * Build the option plan for a menu item.
 *
 * Tags veto a category: a `Hot` drink offers no ice and a `Blended` one offers
 * no sugar even if its category would allow them. Unknown categories fall back
 * to the most permissive plan so a new menu group degrades gracefully instead of
 * silently stripping options the bar can still adjust.
 */
export function buildDrinkOptions(item?: RuleInput | null): DrinkOptionPlan {
  if (!item) {
    return permissivePlan(false);
  }

  if (isReadyToServeItem({ id: item.id, category: item.category, name: item.name })) {
    return { bypass: true, showSweetness: false, showIce: false, sweetnessOptions: [], iceOptions: [], showNotes: false };
  }

  // An unmapped category is treated as a craft drink: offer everything it could
  // plausibly adjust rather than assume a fixed recipe.
  const rules: CategoryRules = CATEGORY_RULES[(item.category ?? '').trim().toLowerCase()]
    ?? { sweetness: 'full', ice: 'full', notes: true };

  // Fixed recipes (blended / bottled / fresh-pressed / jarred) are never adjustable,
  // regardless of what the category table says.
  const allowSweetness = !isFixedRecipe(item.tags) && rules.sweetness != null;
  const allowIce = isIceAllowed(item.tags) && rules.ice != null;

  return {
    bypass: false,
    showSweetness: allowSweetness,
    showIce: allowIce,
    sweetnessOptions: rules.sweetness ? OPTION_SETS[rules.sweetness] : [],
    iceOptions: rules.ice ? ICE_SETS[rules.ice] : [],
    showNotes: rules.notes,
  };
}
