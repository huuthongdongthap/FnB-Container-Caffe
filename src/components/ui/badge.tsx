/**
 * Compatibility shim — canonical implementation lives in BadgeAdapter,
 * rendering the MD3Chip primitive with Material Design 3 tokens.
 * Kept so deep imports (`@/components/ui/badge`) resolve to the MD3 component.
 */
export { Badge, type BadgeAdapterProps as BadgeProps } from '@/components/ui/adapters/BadgeAdapter';
