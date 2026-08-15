/**
 * Types for StitchTrackOrderNew component
 */

export interface TrackOrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  icon?: React.ElementType;
}

export interface StitchTrackOrderNewProps {
  orderId?: string;
  estimatedMinutes?: number;
  items?: TrackOrderItem[];
  total?: number;
  onTrackMap?: () => void;
  onBack?: () => void;
  onNavigate?: (path: string) => void;
}

export interface TimelineStepProps {
  label: string;
  time?: string;
  isActive: boolean;
  isCompleted: boolean;
  isLast: boolean;
}
