export const REWARDS = [
  { name: 'Private Cupping Session', pts: '4,500 PTS', img: '/photos/IMG_6565.webp' },
  { name: 'Limited Edition Vessel', pts: '8,000 PTS', img: '/photos/IMG_6566.webp' },
  { name: 'Artisan Coffee Flight', pts: '2,500 PTS', img: '/photos/IMG_6702.webp' },
] as const;

export const POINTS_HISTORY = [
  { activity: 'Kenya SL28 Purchase', date: 'OCT 24, 2024', status: 'COMPLETED', pts: '+450' },
  { activity: 'Concierge Booking', date: 'OCT 20, 2024', status: 'COMPLETED', pts: '+1,200' },
  { activity: 'Referral Bonus', date: 'OCT 15, 2024', status: 'COMPLETED', pts: '+2,000' },
] as const;

export const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

export const TIER_BENEFITS = [
  'Complementary valet parking / Đỗ xe miễn phí',
  'Priority reservation access / Đặt bàn ưu tiên',
  'Invite-only tasting events / Sự kiện degustation riêng',
  '15% Discount on retail gear / Giảm 15% hàng retail',
] as const;

export const REWARD_HISTORY_DATA = [
  { d: '24 Oct', s: 'J. Vane', a: '+$15.00' },
  { d: '21 Oct', s: 'E. Thorne', a: '+$15.00' },
  { d: '15 Oct', s: 'M. Chen', a: '+$15.00' },
] as const;
