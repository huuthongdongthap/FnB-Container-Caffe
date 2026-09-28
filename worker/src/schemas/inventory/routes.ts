import { ingredientRoutes } from './ingredients';
import { movementRoutes } from './movements';
import { supplierRoutes } from './suppliers';
import { purchaseOrderRoutes } from './purchase-orders';

export const InventoryRoutes = {
  ingredients: ingredientRoutes,
  movements: movementRoutes,
  suppliers: supplierRoutes,
  purchaseOrders: purchaseOrderRoutes,
};
