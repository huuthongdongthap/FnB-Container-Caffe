/**
 * StitchOrderFailureNew — Type definitions
 */

export interface StitchOrderFailureNewProps {
  onRetry?: () => void;
  onPayOS?: () => void;
  onCOD?: () => void;
  onChatSupport?: () => void;
  onCallSupport?: () => void;
  onNavigate?: (path: string) => void;
  isProcessing?: boolean;
}

export interface PaymentOptionProps {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick?: () => void;
}
