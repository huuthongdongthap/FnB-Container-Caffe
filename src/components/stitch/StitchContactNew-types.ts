/**
 * StitchContactNew — Type definitions
 */

export interface StitchContactNewProps {
  onSubmit?: (data: { name: string; email: string; message: string }) => void;
  onNavigate?: (path: string) => void;
  isSubmitting?: boolean;
}
