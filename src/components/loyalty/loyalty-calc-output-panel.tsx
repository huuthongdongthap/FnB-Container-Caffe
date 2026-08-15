import { Card } from '@/components/ui/card';
import { formatVnd } from '@/lib/format';
import { TierProjection } from '@/components/loyalty/tier-projection';
import { ReferralCalculator } from '@/components/loyalty/referral-calculator';
import type { CalculatorInputs } from './loyalty-calculator-types';
import type { getTierForSpend } from '@/hooks/use-loyalty';

type TierConfig = ReturnType<typeof getTierForSpend>;

interface Projections {
  tierConfig: TierConfig;
  cashbackRate: number;
  birthdayBonus: number;
  monthlyPoints: number;
  annualPoints: number;
  monthlyCashbackVnd: number;
  annualCashbackVnd: number;
  referralEarningsVnd: number;
  annualReferralEarnings: number;
  totalMonthlyBenefit: number;
  totalAnnualBenefit: number;
}

interface OutputPanelProps {
  projections: Projections;
}

export function OutputPanel({ projections }: OutputPanelProps) {
  return (
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
  );
}
