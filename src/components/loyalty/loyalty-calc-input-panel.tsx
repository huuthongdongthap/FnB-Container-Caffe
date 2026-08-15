import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { REFERRAL_CASHBACK_VND } from '@/hooks/use-referral';
import { formatVnd } from '@/lib/format';
import type { CalculatorInputs } from './loyalty-calculator-types';

interface InputPanelProps {
  inputs: CalculatorInputs;
  onInputChange: (key: keyof CalculatorInputs, value: string) => void;
  onRangeChange: (key: keyof CalculatorInputs, value: number) => void;
}

export function InputPanel({ inputs, onInputChange, onRangeChange }: InputPanelProps) {
  const { t } = useTranslation();

  return (
    <Card className="space-y-6 p-6">
      <div>
        <h3 className="font-display text-lg font-bold">{t('loyaltyCalc.enterInfo')}</h3>
        <p className="text-xs text-muted/60">
          {t('loyaltyCalc.adjustValues')}
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
            onChange={(e) => onInputChange('monthlySpend', e.target.value)}
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
            onChange={(e) => onRangeChange('visitFrequency', Number(e.target.value))}
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
            onChange={(e) => onRangeChange('referralCount', Number(e.target.value))}
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
  );
}
