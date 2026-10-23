/**
 * Menu Customization Rules
 * Determines which items are craft drinks (requiring sweetness and ice levels)
 * versus ready-to-serve / packaged products (bottled water, canned sodas, yogurt cups, whole coconuts)
 * that should NEVER prompt for sugar or ice.
 */

// Category keys that represent pre-packaged, non-craft goods
export const READY_TO_SERVE_CATEGORIES = new Set([
  'bottled',
  'packaged',
  'snack',
  'canned',
]);

// Explicit item IDs that are pre-made or served whole without barista formulation
export const READY_TO_SERVE_ITEM_IDS = new Set([
  // Yaourt hũ: 'yo004' is the offline fallback id, 'yg004' the catalog id — both must bypass.
  'yo004',
  'yg004',
  'jc004', // Dừa trái (nguyên quả tươi)
  'od002', // Bình trà bắc (bình mộc nóng ngồi lâu)
  'bt001', // Nước suối đóng chai
  'bt002', // Sting / Coca / Pepsi / 7UP / Ô long
  'bt003', // Redbull lon
]);

/**
 * Check if a menu item is a ready-to-serve / packaged product.
 * Returns true if the item should bypass the drink customization modal
 * (no sweetness or ice levels — the drink is served as it is packaged).
 */
export function isReadyToServeItem(item?: {
  id?: string;
  category?: string;
  name?: string;
} | null): boolean {
  if (!item) return false;

  const id = (item.id || '').trim().toLowerCase();
  if (READY_TO_SERVE_ITEM_IDS.has(id)) {
    return true;
  }

  const category = (item.category || '').trim().toLowerCase();
  if (READY_TO_SERVE_CATEGORIES.has(category)) {
    return true;
  }

  const name = (item.name || '').toLowerCase();
  // Keyword checks for fallback safety
  if (
    name.includes('nước suối') ||
    name.includes('đóng chai') ||
    name.includes('yaourt hũ') ||
    name.includes('dừa trái') ||
    name.includes('bình trà bắc') ||
    name.includes('redbull') ||
    name.includes('sting') ||
    name.includes('coca') ||
    name.includes('pepsi') ||
    name.includes('7up')
  ) {
    return true;
  }

  return false;
}
