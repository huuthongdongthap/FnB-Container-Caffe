/**
 * Inventory management schemas — compatibility barrel
 * Re-exports from ./inventory/ submodules for zero-breaking-imports.
 */
export {
  IngredientTranslationSchema,
  IngredientCreateSchema,
  IngredientUpdateSchema,
  IngredientResponseSchema,
  IngredientListResponseSchema,
  type IngredientTranslation,
  type IngredientCreate,
  type IngredientUpdate,
  type IngredientResponse,
  type IngredientListResponse,
  ingredientRoutes,
} from './inventory/ingredients';

export {
  StockMovementSchema,
  StockMovementCreateSchema,
  StockMovementListResponseSchema,
  type StockMovement,
  type StockMovementCreate,
  type StockMovementListResponse,
  movementRoutes,
} from './inventory/movements';

export {
  SupplierSchema,
  SupplierCreateSchema,
  SupplierUpdateSchema,
  SupplierListResponseSchema,
  type Supplier,
  type SupplierCreate,
  type SupplierUpdate,
  type SupplierListResponse,
  supplierRoutes,
} from './inventory/suppliers';

export {
  PurchaseOrderSchema,
  PurchaseOrderCreateSchema,
  PurchaseOrderUpdateSchema,
  PurchaseOrderListResponseSchema,
  type PurchaseOrder,
  type PurchaseOrderCreate,
  type PurchaseOrderUpdate,
  type PurchaseOrderListResponse,
  purchaseOrderRoutes,
} from './inventory/purchase-orders';

export { InventoryRoutes } from './inventory/routes';
