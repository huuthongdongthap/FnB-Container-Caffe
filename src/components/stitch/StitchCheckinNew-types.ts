/**
 * StitchCheckinNew — TypeScript interfaces
 */

export interface StitchCheckinNewProps {
  onCheckin?: (phone: string) => void;
  onMenu?: () => void;
  onAccount?: () => void;
  onNavigate?: (path: string) => void;
  isLoading?: boolean;
}
