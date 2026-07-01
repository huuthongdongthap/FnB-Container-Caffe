import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { getTierForSpend } from '@/hooks/use-loyalty';
import { REFERRAL_CASHBACK_VND } from '@/hooks/use-referral';
import { formatVnd } from '@/lib/format';
import { TierProjection } from '@/components/loyalty/tier-projection';
import { ReferralCalculator } from '@/components/loyalty/referral-calculator';

interface CalculatorInputs {
  monthlySpend: number;
  visitFrequency: number;
  referralCount: number;
}

// Tier-specific cashback rates (matching loyalty.html)
const TIER_CASHBACK: Record<string, number> = {
  bronze: 3,
  silver: 5,
  gold: 7,
  platinum: 10,
};

// Birthday bonus per tier
const TIER_BIRTHDAY: Record<string, number> = {
  bronze: 10,
  silver: 10,
  gold: 15,
  platinum: 20,
};

export function LoyaltyCalculator() {
  const [inputs, setInputs] = useState<CalculatorInputs>({
    monthlySpend: 2500000,
    visitFrequency: 8,
    referralCount: 0,
  });

  const projections = useMemo(() => {
    const { monthlySpend, visitFrequency, referralCount } = inputs;

    // Calculate projected tier based on annualized spend
    const annualSpend = monthlySpend * 12;
    const tierConfig = getTierForSpend(annualSpend);
    const cashbackRate = TIER_CASHBACK[tierConfig.tier] ?? 3;
    const birthdayBonus = TIER_BIRTHDAY[tierConfig.tier] ?? 10;

    // Points calculation
    const pointsPerVisit = Math.round(monthlySpend / visitFrequency / 10000);
    const monthlyPoints = pointsPerVisit * visitFrequency * tierConfig.pointsMultiplier;
    const annualPoints = monthlyPoints * 12;

    // Cashback value
    const monthlyCashbackVnd = Math.round(monthlySpend * (cashbackRate / 100));
    const annualCashbackVnd = monthlyCashbackVnd * 12;

    // Referral earnings
    const referralEarningsVnd = referralCount * REFERRAL_CASHBACK_VND;
    const annualReferralEarnings = referralEarningsVnd * 12;

    // Total benefits
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

  const setNumericInput = (key: keyof CalculatorInputs, value: string) => {
    const num = parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
    setInputs((prev) => ({ ...prev, [key]: num }));
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* INPUT PANEL */}
      <Card className="space-y-6 p-6">
        <div>
          <h3 className="font-display text-lg font-bold">Nhap thong tin</h3>
          <p className="text-xs text-muted/60">
            Dieu chinh cac chi so de mo phong loi nhieu cua ban
          </p>
        </div>

        {/* Monthly Spend */}
        <div>
          <label
            htmlFor="calc-spend"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted/60"
          >
            Chi tieu hang thang
          </label>
          <div className="relative">
            <input
              id="calc-spend"
              type="text"
              inputMode="numeric"
              value={formatVnd(inputs.monthlySpend)}
              onChange={(e) => setNumericInput('monthlySpend', e.target.value)}
              className="w-full rounded-lg border border-border/40 bg-background px-4 py-2.5 font-display text-lg font-bold outline-none transition-colors focus:border-accent"
            />
          </div>
        </div>

        {/* Visit Frequency */}
        <div>
          <label
            htmlFor="calc-frequency"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted/60"
          >
            Tan suat ghe tham (lan/thang)
          </label>
          <div className="flex items-center gap-3">
            <input
              id="calc-frequency"
              type="range"
              min={1}
              max={30}
              value={inputs.visitFrequency}
              onChange={(e) => setInputs({ ...inputs, visitFrequency: Number(e.target.value) })}
              className="flex-1 accent-accent"
            />
            <span className="w-8 text-center text-sm font-bold text-accent">
              {inputs.visitFrequency}
            </span>
          </div>
        </div>

        {/* Referral Count */}
        <div>
          <label
            htmlFor="calc-referrals"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted/60"
          >
            So luot gioi thieu (thang)
          </label>
          <div className="flex items-center gap-3">
            <input
              id="calc-referrals"
              type="range"
              min={0}
              max={50}
              value={inputs.referralCount}
              onChange={(e) => setInputs({ ...inputs, referralCount: Number(e.target.value) })}
              className="flex-1 accent-accent"
            />
            <span className="w-8 text-center text-sm font-bold text-accent">
              {inputs.referralCount}
            </span>
          </div>
        </div>

        {/* Referral cashback note */}
        <div className="rounded-lg bg-muted/10 p-3 text-xs text-muted/60">
          <p>
            &bull; Moi luot gioi thieu: <strong>{formatVnd(REFERRAL_CASHBACK_VND)}</strong> cashback
          </p>
          <p>&bull; Ban be phai co don hang &ge; 20.000d</p>
          <p>&bull; Khong gioi han so lan gioi thieu</p>
        </div>
      </Card>

      {/* OUTPUT PANEL */}
      <div className="space-y-4">
        <TierProjection
          rank={projections.tierConfig.rank}
          cashbackRate={projections.cashbackRate}
          monthlyPoints={projections.monthlyPoints}
          annualPoints={projections.annualPoints}
        />

        {/* Cashback Value */}
        <Card className="p-6">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted/60">
            Gia tri cashback
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xl font-bold text-accent-warm">
                {formatVnd(projections.monthlyCashbackVnd)}
              </p>
              <p className="text-xs text-muted/60">cashback / thang</p>
            </div>
            <div>
              <p className="text-xl font-bold text-accent-warm">
                {formatVnd(projections.annualCashbackVnd)}
              </p>
              <p className="text-xs text-muted/60">cashback / nam</p>
            </div>
          </div>
        </Card>

        <ReferralCalculator
          monthlyEarnings={projections.referralEarningsVnd}
          annualEarnings={projections.annualReferralEarnings}
        />

        {/* Total Benefit */}
        <Card className="border-2 border-accent/30 p-6">
          <p className="text-xs uppercase tracking-wider text-muted/60">
            Tong loi ich uoc tinh
          </p>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold text-foreground">
                {formatVnd(projections.totalMonthlyBenefit)}
              </p>
              <p className="text-xs text-muted/60">moi thang</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {formatVnd(projections.totalAnnualBenefit)}
              </p>
              <p className="text-xs text-muted/60">moi nam</p>
            </div>
          </div>
        </Card>

        {/* Birthday bonus hint */}
        <p className="text-center text-xs text-muted/40">
          * Uu dai sinh nhat: {projections.birthdayBonus}% giam gia cho don hang trong thang sinh nhat
        </p>
      </div>
    </div>
  );
}
