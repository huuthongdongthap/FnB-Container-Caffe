// @aura/domain-catalog — Catalog bounded context
// Products, categories, menu, modifiers, happy-hour + zod-openapi contracts.

// Model types
export type {
  Product,
  Category,
  ModifierGroup,
  ModifierChoice,
  ProductModifierGroup,
  HappyHourWindow,
} from './model/catalog-types';

// Commands (Hono routers)
export { productsRouter } from './commands/products';
export { categoriesRouter } from './commands/categories';
export { menuModifiersRouter } from './commands/menu-modifiers';
export { happyHourRouter } from './commands/happy-hour';

// Queries (plain handlers)
export { getMenu, getMenuItem } from './queries/menu';

// M4 Online — customer-facing menu view
export { getCustomerMenu, getCustomerMenuItem } from './commands/get-customer-menu';
export type { CustomerMenu, CustomerMenuItem, CustomerMenuCategory, CustomerMenuOptions } from './commands/get-customer-menu';

// Policies
export { happyHourDiscountFor, resolveItemPrice, normalizeChannel } from './policies/pricing';
export type { Channel, ChannelDeltaConfig, ResolveItemPriceInput } from './policies/pricing';
export { resolveServerProductPrice } from './policies/pricing-resolver';
export type { ResolveServerPriceInput, ResolvedServerPrice } from './policies/pricing-resolver';
export { validateProductModifiers } from './policies/modifier-validation';
export type {
  ModifierValidationRejection,
  ModifierValidationResult,
} from './policies/modifier-validation';
export { parseAvailabilityFilter, toAvailabilityFlag } from './policies/availability';
export {
  mapProductToMenuProjection,
  syncProductToMenuProjection,
  syncProductAvailabilityProjection,
  deleteProductProjection,
  syncCategorySlugToMenuProjection,
  reconcileAllMenuProjections,
} from './policies/menu-projection';
export type { MenuItemProjection } from './policies/menu-projection';

// OpenAPI contracts
export * from './schemas/products';
export * from './schemas/categories';
export * from './schemas/menu';
