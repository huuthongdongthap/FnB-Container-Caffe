export const REWARDS = [
  { name: 'Private Cupping Session', pts: '4,500 PTS', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB5VoyAqqlj9v1p_Fd0vKnkJbm4fDpCbBfcfnGk9iXWJsQkUY4p9MwZE9gW4aIGDezgU5nVuKq9kA5nJlELipUIKxSAu-iJ0TyddMgMz4EetP8GtGSFzEHu72d1fnLIk3pCADfO75fGMgJjAfybKZas0EOq-e0Wu_847djVJd6nISO3cs0Pjyb7NUii2ULfHnRyQW30Laqzeso6-81-OMMeqPUorTlgkBBRabwNARHVIRCd7uvVvxzFycbE1Y4I-ysk4OWL4tc5Mtk' },
  { name: 'Limited Edition Vessel', pts: '8,000 PTS', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD1ZYyk4mbXZG3-ZeOC-Q5TZST8LNWGfeghQ08Q6qfgBKPaqKi2xvxzOhGO64VKfR7PP8RlK7NqYc5d0KyUivemYw5JwC_jdKmOULyvxP6-iAfdcE3TynE0mhz2DNdVaaRjQQi2rnuYdumCRNtZb-HNEiKa1grVkNIXGPNK9z0SxwpgcmyPwiY8KGLjvlpu-inWp6t01uR2oV28qWJNBVzw7R7ne9nt747XKEB9Q2FKmg7c_NrELvOi2xwOpzmbhqX2YaBD_vG3uRE' },
  { name: 'Artisan Coffee Flight', pts: '2,500 PTS', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAHAfEGOOefIl2MVbYXeX3iigZB8rveXFZ7jluS_IW7_nDi6Phokeh3xVop2G1btyCwd2nrPhZnWVDIeCsGyK_u0ukBnx06WTAn2Irk1_14p99qJYFVXOIyjxQPmBB5ONiDOz-sZHx1_hSVTRDTwU7zj75xxi5_-LTat6pQ36So9JPYZ4X4k9sCoOIWYVgr_SmQXuEaD9hCKRXmaI-eicBKDQJnGmeubIirNBf0n4CzrYV1-4-CnEiGR7ksClo00VjDHOFshsJkssc' },
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
