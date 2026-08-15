/* ── Types for Referral Rewards 1 ──────────────────────────────────────── */

export interface InnerProps {
  copied: boolean;
  onCopy: () => void;
}

export interface ShareChannel {
  readonly label: string;
  readonly icon: string;
}

export interface Friend {
  readonly name: string;
  readonly joined: string;
  readonly status: 'active' | 'joined';
}

export interface Reward {
  readonly date: string;
  readonly source: string;
  readonly amount: string;
}
