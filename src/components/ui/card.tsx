/**
 * Compatibility shim — canonical implementation lives in CardAdapter,
 * rendering the MD3Card primitive with Material Design 3 tokens.
 * Kept so deep imports (`@/components/ui/card`) resolve to the MD3 component.
 */
export {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  type CardAdapterProps as CardProps,
} from '@/components/ui/adapters/CardAdapter';
