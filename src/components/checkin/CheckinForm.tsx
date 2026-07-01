import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

interface CheckinFormProps {
  onSubmit?: (phone: string) => Promise<void>;
  ineligibleReason?: string;
  className?: string;
}

const VIETNAMESE_PHONE_REGEX = /^(0\d{9,10})$/;

export function CheckinForm({ onSubmit, ineligibleReason, className }: CheckinFormProps) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const phoneClean = phone.replace(/[\s.\-]/g, '');
    if (!VIETNAMESE_PHONE_REGEX.test(phoneClean)) {
      setError('Số điện thoại không hợp lệ. Vui lòng nhập số di động Việt Nam (VD: 0901234567)');
      return;
    }

    if (onSubmit) {
      setIsLoading(true);
      try {
        await onSubmit(phoneClean);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Lỗi kết nối');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className={cn('max-w-md mx-auto', className)}>
      {ineligibleReason === 'already_checked_in_this_month' && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          Bạn đã check-in tháng này rồi! Một khách hàng chỉ check-in 1 lần trong tháng.
        </div>
      )}

      {ineligibleReason === 'no_active_campaign' && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm">
          Hiện không có chương trình check-in nào hoạt động.
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-4">
          <Input
            label="Số điện thoại"
            id="checkin-phone"
            type="tel"
            placeholder="VD: 0901234567"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (error) setError(null);
            }}
            error={error || undefined}
            maxLength={11}
            required
          />
        </div>
        <Button type="submit" loading={isLoading} className="w-full" size="lg">
          Tiếp tục
        </Button>
      </form>
    </div>
  );
}
