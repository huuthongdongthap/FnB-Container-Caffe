/**
 * Types for StitchReservationNew component.
 */

export interface ZoneData {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
}

export interface StitchReservationNewProps {
  zones?: ZoneData[];
  onBack?: () => void;
  onClose?: () => void;
}
