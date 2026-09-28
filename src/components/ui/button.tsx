/**
 * Compatibility shim — the canonical implementation now lives in the adapter,
 * which renders the MD3 primitive with Material Design 3 tokens.
 * Kept so deep imports (`@/components/ui/button`) resolve to the MD3 component
 * instead of a divergent second Button implementation.
 */
export { Button } from '@/components/ui/adapters/ButtonAdapter';
export type { ButtonAdapterProps as ButtonProps } from '@/components/ui/adapters/ButtonAdapter';
