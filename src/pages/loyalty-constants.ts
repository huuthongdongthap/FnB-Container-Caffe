export const WEEK_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

export const TIER_BENEFIT_KEYS = ['benefit1', 'benefit2', 'benefit3', 'benefit4'];

export const DEFAULT_CHECKIN: Record<string, boolean> = {
  MON: true,
  TUE: true,
  WED: true,
  THU: false,
  FRI: false,
  SAT: false,
};

/** Default campaign image URLs from the Stitch design. */
export const REWARD_IMAGES = [
  '/photos/IMG_6565.webp',
  '/photos/IMG_6566.webp',
  '/photos/IMG_6702.webp',
];
