// @aura/domain-inventory — Inventory bounded context
// model
export type {
  InventoryItem,
  InventoryTransaction,
  InventorySnapshot,
  InventoryCategory,
  InventoryTransactionType,
  ReferenceType,
} from './src/model/inventory-types';
export type { InventoryItemInput, InventoryTransactionInput } from './src/model/inventory-schemas';
export { inventoryItemSchema, inventoryTransactionSchema } from './src/model/inventory-schemas';
// routes
export { inventoryCRUD, inventoryTransactions, inventorySnapshots } from './src/routes';
// policies
export { deductInventoryForOrder, restoreInventoryForOrder } from './src/routes/order-deduction';
export { deductIngredientsForOrder, calculateBomDepletion, getRecipeForProduct } from './src/policies/bom-policy';
// types
export type { Supplier, PurchaseOrderInput, RecipeComponent, Recipe } from './src/model/supplier-policy';
