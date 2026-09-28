/**
 * Legacy toast module — re-export shim.
 *
 * Kept so existing deep imports (`@/components/ui/toast`) resolve to the
 * adapter implementation (MD3Snackbar-backed) instead of a stale duplicate.
 */
export { useToast, ToastProvider } from '@/components/ui/adapters/ToastAdapter';
export type { Toast } from '@/components/ui/adapters/ToastAdapter';
