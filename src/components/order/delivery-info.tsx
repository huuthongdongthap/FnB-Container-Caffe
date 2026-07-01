import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

interface DeliveryInfoProps {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  ward: string;
  notes: string;
  errors: Record<string, string | undefined>;
  onChange: (field: string, value: string) => void;
  disabled?: boolean;
}

export function DeliveryInfo({
  fullName,
  email,
  phone,
  address,
  ward,
  notes,
  errors,
  onChange,
  disabled,
}: DeliveryInfoProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-display text-lg font-semibold text-foreground">
        Thông tin giao hàng
      </h3>

      <Input
        label="Họ và Tên *"
        placeholder="Nguyễn Văn A"
        value={fullName}
        onChange={(e) => onChange('fullName', e.target.value)}
        error={errors.fullName}
        disabled={disabled}
        required
      />

      <Input
        label="Số điện thoại *"
        placeholder="09xx xxx xxx"
        type="tel"
        value={phone}
        onChange={(e) => onChange('phone', e.target.value)}
        error={errors.phone}
        disabled={disabled}
        required
      />

      <Input
        label="Email"
        placeholder="email@domain.com"
        type="email"
        value={email}
        onChange={(e) => onChange('email', e.target.value)}
        error={errors.email}
        disabled={disabled}
      />

      <Input
        label="Địa chỉ giao hàng *"
        placeholder="Số nhà, đường"
        value={address}
        onChange={(e) => onChange('address', e.target.value)}
        error={errors.address}
        disabled={disabled}
        required
      />

      <Input
        label="Phường/Xã"
        placeholder="Chọn phường/xã"
        value={ward}
        onChange={(e) => onChange('ward', e.target.value)}
        error={errors.ward}
        disabled={disabled}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="delivery-notes" className="text-sm font-medium text-foreground">
          Ghi chú
        </label>
        <textarea
          id="delivery-notes"
          className={cn(
            'rounded-lg border border-border bg-white px-4 py-2.5 text-base text-foreground',
            'placeholder:text-muted transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'min-h-[80px] resize-y',
          )}
          placeholder="Bàn số, yêu cầu đặc biệt..."
          value={notes}
          onChange={(e) => onChange('notes', e.target.value)}
          disabled={disabled}
          maxLength={500}
        />
        {errors.notes && (
          <p className="text-sm text-destructive" role="alert">{errors.notes}</p>
        )}
      </div>
    </div>
  );
}
