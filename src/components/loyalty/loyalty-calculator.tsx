import { useState, useMemo } from 'react';
import { getTierForSpend } from '@/hooks/use-loyalty';
import { REFERRAL_CASHBACK_VND } from '@/hooks/use-referral';
import {
  TIER_CASHBACK,
  TIER_BIRTHDAY,
  type CalculatorInputs,
} from './loyalty-calculator-types';
import { InputPanel } from './loyalty-calc-input-panel';
import { OutputPanel } from './loyalty-calc-output-panel';

const DEFAULT_INPUTS: CalculatorInputs = {
  monthlySpend: 2500000,
  visitFrequency: 8,
  referralCount: 0,
};

export function LoyaltyCalculator() {
  const [inputs, setInputs] = useState<CalculatorInputs>(DEFAULT_INPUTS);

  const projections = useMemo(() => {
    const { monthlySpend, visitFrequency, referralCount } = inputs;

    const annualSpend = monthlySpend * 12;
    const tierConfig = getTierForSpend(annualSpend);
    const cashbackRate = TIER_CASHBACK[tierConfig.tier] ?? 3;
    const birthdayBonus = TIER_BIRTHDAY[tierConfig.tier] ?? 10;

    const pointsPerVisit = Math.round(monthlySpend / visitFrequency / 10000);
    const monthlyPoints = pointsPerVisit * visitFrequency * tierConfig.pointsMultiplier;
    const annualPoints = monthlyPoints * 12;

    const monthlyCashbackVnd = Math.round(monthlySpend * (cashbackRate / 100));
    const annualCashbackVnd = monthlyCashbackVnd * 12;

    const referralEarningsVnd = referralCount * REFERRAL_CASHBACK_VND;
    const annualReferralEarnings = referralEarningsVnd * 12;

    const totalMonthlyBenefit = monthlyCashbackVnd + referralEarningsVnd;
    const totalAnnualBenefit = annualCashbackVnd + annualReferralEarnings;

    return {
      tierConfig,
      cashbackRate,
      birthdayBonus,
      pointsPerVisit,
      monthlyPoints,
      annualPoints,
      monthlyCashbackVnd,
      annualCashbackVnd,
      referralEarningsVnd,
      annualReferralEarnings,
      totalMonthlyBenefit,
      totalAnnualBenefit,
    };
  }, [inputs]);

  const handleInputChange = (key: keyof CalculatorInputs, value: string) => {
    const num = parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
    setInputs((prev) => ({ ...prev, [key]: num }));
  };

  const handleRangeChange = (key: keyof CalculatorInputs, value: number) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <InputPanel
        inputs={inputs}
        onInputChange={handleInputChange}
        onRangeChange={handleRangeChange}
      />
      <OutputPanel projections={projections} />
    </div>
  );
}
