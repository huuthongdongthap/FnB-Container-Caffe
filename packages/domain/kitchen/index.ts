// @aura/domain-kitchen — Kitchen bounded context
// commands
export { getKdsMobile, updateKdsStatus } from './commands/kds-mobile';
export { kdsStreamRouter } from './commands/kds-stream';
export { kitchenStationsRouter } from './commands/kitchen-stations';
export type { KitchenStation, CategoryStation, OrderItemStation } from './commands/kitchen-stations';
// policies
export {
  buildCategoryStationIndex,
  buildIndexFromDbRows,
  parseOrderItems,
  routeItemToStation,
  groupItemsByStation,
  filterItemsForStation,
} from './src/policies/station-policy';
export type {
  StationCategoryMapping,
  RoutedItem,
  StationGroup,
} from './src/policies/station-policy';
