// @aura/domain-kitchen — Kitchen bounded context
// commands
export { getKdsMobile, updateKdsStatus } from './commands/kds-mobile';
export { kdsStreamRouter } from './commands/kds-stream';
export { kitchenStationsRouter } from './commands/kitchen-stations';
export { stationTicketsRouter } from './commands/kitchen-station-tickets';
export type { KitchenStation, CategoryStation, OrderItemStation } from './commands/kitchen-stations';
export { executeKdsStatusTransition } from './commands/kds-status-transition';
export type { TransitionKdsResult, KdsTransitionDb, KdsTransitionOptions } from './commands/kds-status-transition';
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
