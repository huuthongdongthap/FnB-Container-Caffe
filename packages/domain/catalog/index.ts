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

// Queries (plain handlers)
export { getMenu, getMenuItem } from './queries/menu';

// M4 Online — customer-facing menu view
export { getCustomerMenu, getCustomerMenuItem } from './commands/get-customer-menu';
export type { CustomerMenu, CustomerMenuItem, CustomerMenuCategory, CustomerMenuOptions } from './commands/get-customer-menu';

// Policies
export { happyHourDiscountFor } from './policies/pricing';
export { parseAvailabilityFilter, toAvailabilityFlag } from './policies/availability';

// OpenAPI contracts
export * from './schemas/products';
export * from './schemas/categories';
export * from './schemas/menu';
