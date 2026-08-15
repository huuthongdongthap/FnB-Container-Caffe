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
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB5VoyAqqlj9v1p_Fd0vKnkJbm4fDpCbBfcfnGk9iXWJsQkUY4p9MwZE9gW4aIGDezgU5nVuKq9kA5nJlELipUIKxSAu-iJ0TyddMgMz4EetP8GtGSFzEHu72d1fnLIk3pCADfO75fGMgJjAfybKZas0EOq-e0Wu_847djVJd6nISO3cs0Pjyb7NUii2ULfHnRyQW30Laqzeso6-81-OMMeqPUorTlgkBBRabwNARHVIRCd7uvVvxzFycbE1Y4I-ysk4OWL4tc5Mtk',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuD1ZYyk4mbXZG3-ZeOC-Q5TZST8LNWGfeghQ08Q6qfgBKPaqKi2xvxzOhGO64VKfR7PP8RlK7NqYc5d0KyUivemYw5JwC_jdKmOULyvxP6-iAfdcE3TynE0mhz2DNdVaaRjQQi2rnuYdumCRNtZb-HNEiKa1grVkNIXGPNK9z0SxwpgcmyPwiY8KGLjvlpu-inWp6t01uR2oV28qWJNBVzw7R7ne9nt747XKEB9Q2FKmg7c_NrELvOi2xwOpzmbhqX2YaBD_vG3uRE',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAHAfEGOOefIl2MVbYXeX3iigZB8rveXFZ7jluS_IW7_nDi6Phokeh3xVop2G1btyCwd2nrPhZnWVDIeCsGyK_u0ukBnx06WTAn2Irk1_14p99qJYFVXOIyjxQPmBB5ONiDOz-sZHx1_hSVTRDTwU7zj75xxi5_-LTat6pQ36So9JPYZ4X4k9sCoOIWYVgr_SmQXuEaD9hCKRXmaI-eicBKDQJnGmeubIirNBf0n4CzrYV1-4-CnEiGR7ksClo00VjDHOFshsJkssc',
];
