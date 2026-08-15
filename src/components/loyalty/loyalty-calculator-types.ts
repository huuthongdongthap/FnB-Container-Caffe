export interface CalculatorInputs {
  monthlySpend: number;
  visitFrequency: number;
  referralCount: number;
}

// Tier-specific cashback rates (matching loyalty.html)
export const TIER_CASHBACK: Record<string, number> = {
  bronze: 3,
  silver: 5,
  gold: 7,
  platinum: 10,
};

// Birthday bonus per tier
export const TIER_BIRTHDAY: Record<string, number> = {
  bronze: 10,
  silver: 10,
  gold: 15,
  platinum: 20,
};
