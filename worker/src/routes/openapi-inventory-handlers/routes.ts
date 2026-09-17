import { OpenAPIHono } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth';
import type { Env } from '../../types/env';
import { registerIngredientHandlers } from './ingredient-handlers';
import { registerMovementHandlers } from './movement-handlers';
import { registerSupplierHandlers } from './supplier-handlers';
import { registerPurchaseOrderHandlers } from './purchase-order-handlers';

export const openApiInventoryRouter = new OpenAPIHono<{ Bindings: Env }>();

// Auth middleware for all inventory routes
openApiInventoryRouter.use('*', requireAuth);

// Register all inventory sub-handlers
registerIngredientHandlers(openApiInventoryRouter);
registerMovementHandlers(openApiInventoryRouter);
registerSupplierHandlers(openApiInventoryRouter);
registerPurchaseOrderHandlers(openApiInventoryRouter);

export default openApiInventoryRouter;
