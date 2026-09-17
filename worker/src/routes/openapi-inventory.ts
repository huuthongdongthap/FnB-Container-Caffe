/**
 * Inventory OpenAPI routes barrel re-export
 * Split into worker/src/routes/openapi-inventory-handlers/
 * - routes.ts: Hono route router and middleware
 * - ingredient-handlers.ts: CRUD for ingredients
 * - movement-handlers.ts: List and create stock movements
 * - supplier-handlers.ts: CRUD for suppliers
 * - purchase-order-handlers.ts: CRUD and receive for purchase orders
 * - index.ts: Barrel export
 */

import { openApiInventoryRouter } from './openapi-inventory-handlers';

export { openApiInventoryRouter } from './openapi-inventory-handlers';
export default openApiInventoryRouter;
