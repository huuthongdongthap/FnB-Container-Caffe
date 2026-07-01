import { Card } from '@/components/ui/card';
import { formatVnd } from '@/lib/format';

interface ReferralCalculatorProps {
  monthlyEarnings: number;
  annualEarnings: number;
  className?: string;
}

export function ReferralCalculator({
  monthlyEarnings,
  annualEarnings,
  className,
}: ReferralCalculatorProps) {
  return (
    <Card className={`p-6 ${className ?? ''}`}>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted/60">
        Thu nhap tu gioi thieu
      </h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xl font-bold text-accent-warm">
            {formatVnd(monthlyEarnings)}
          </p>
          <p className="text-xs text-muted/60">thu nhap / thang</p>
        </div>
        <div>
          <p className="text-xl font-bold text-accent-warm">
            {formatVnd(annualEarnings)}
          </p>
          <p className="text-xs text-muted/60">thu nhap / nam</p>
        </div>
      </div>
    </Card>
  );
}
