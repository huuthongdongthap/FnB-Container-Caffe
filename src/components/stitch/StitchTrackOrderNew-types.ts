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
  /** Live order status (pending → confirmed → preparing → ready → served/delivered). Drives the timeline when provided. */
  status?: string;
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
