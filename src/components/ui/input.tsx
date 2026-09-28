/**
 * Compatibility shim — canonical implementation lives in InputAdapter,
 * rendering the MD3TextField primitive with Material Design 3 tokens.
 * Kept so deep imports (`@/components/ui/input`) resolve to the MD3 component.
 */
export { Input, type InputAdapterProps as InputProps } from '@/components/ui/adapters/InputAdapter';
