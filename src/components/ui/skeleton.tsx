/**
 * Legacy Skeleton module — re-export shim.
 *
 * Kept so existing deep imports (`@/components/ui/skeleton`) resolve to the
 * adapter implementation instead of a stale duplicate.
 */
export { Skeleton } from '@/components/ui/adapters/SkeletonAdapter';
export type {
  SkeletonAdapterProps as SkeletonProps,
  SkeletonVariant,
} from '@/components/ui/adapters/SkeletonAdapter';
