/**
 * Compatibility shim — canonical implementation lives in ModalAdapter,
 * rendering the MD3Dialog primitive with Material Design 3 tokens.
 * Kept so deep imports (`@/components/ui/modal`) resolve to the MD3 component.
 */
export { Modal, type ModalAdapterProps as ModalProps } from '@/components/ui/adapters/ModalAdapter';
