/**
 * StitchStoryNew — TypeScript interfaces and types.
 *
 * Shared types consumed by the story page and its sub-components.
 */

export interface TeamMember {
  name: string;
  role: string;
  imageUrl: string;
  imageAlt: string;
}

export interface StitchStoryNewProps {
  heroBgUrl?: string;
  teamMembers?: TeamMember[];
  onCtaClick?: () => void;
  onNavClick?: (section: string) => void;
}
