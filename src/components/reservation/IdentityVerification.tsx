import { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface IdentityData {
  name: string;
  phone: string;
}

interface IdentityVerificationProps {
  open: boolean;
  onClose: () => void;
  onVerify: (data: IdentityData) => void;
}

const VIETNAMESE_PHONE_REGEX = /^(0[35789]\d{8}|(\+84|84)[35789]\d{8})$/;

export function IdentityVerification({ open, onClose, onVerify }: IdentityVerificationProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setPhone('');
      setErrors({});
      // Focus name input when modal opens
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { name?: string; phone?: string } = {};

    if (!name || name.trim().length < 2) {
      newErrors.name = 'Vui lòng nhập tên hợp lệ (tối thiểu 2 ký tự)';
    }

    const phoneClean = phone.replace(/[\s.\-]/g, '');
    if (!VIETNAMESE_PHONE_REGEX.test(phoneClean)) {
      newErrors.phone = 'Số điện thoại không hợp lệ. Vui lòng nhập số di động Việt Nam (VD: 0901234567)';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onVerify({ name: name.trim(), phone: phoneClean });
  };

  return (
    <Modal open={open} onClose={onClose} title="Thông Tin Đặt Bàn">
      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-4">
          <Input
            ref={nameRef}
            label="Họ và tên *"
            id="identity-name"
            placeholder="Nguyễn Văn A"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            error={errors.name}
            required
          />
        </div>
        <div className="mb-6">
          <Input
            label="Số điện thoại *"
            id="identity-phone"
            type="tel"
            placeholder="0901234567"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
            }}
            error={errors.phone}
            required
          />
        </div>
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit">
            Xác Nhận
          </Button>
        </div>
      </form>
    </Modal>
  );
}
