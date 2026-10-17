import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    fullName: string;
    phone: string;
    birthYear?: string;
    position: 'barista' | 'service';
    shifts: string[];
    experience: string;
    note?: string;
  }) => Promise<void>;
}

export function AddCandidateModal({ open, onClose, onSubmit }: ModalProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    birthYear: '',
    position: 'barista' as 'barista' | 'service',
    shifts: ['morning'] as string[],
    experience: 'none',
    note: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleShift = (shift: string) => {
    setFormData((prev) => ({
      ...prev,
      shifts: prev.shifts.includes(shift)
        ? prev.shifts.filter((s) => s !== shift)
        : [...prev.shifts, shift],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.phone.trim()) {
      setError('Vui lòng nhập tên và số điện thoại');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSubmit(formData);
      onClose();
      setFormData({
        fullName: '',
        phone: '',
        birthYear: '',
        position: 'barista',
        shifts: ['morning'],
        experience: 'none',
        note: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi thêm hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('adminStaff.addCandidate', 'Tiếp nhận hồ sơ ứng viên')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-sm text-destructive bg-destructive/10 p-2.5 rounded-lg">{error}</div>}

        <div>
          <label className="text-xs font-medium text-muted block mb-1">Họ và tên *</label>
          <Input
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            placeholder="VD: Nguyễn Văn A"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Số điện thoại *</label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="VD: 0986470981"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Năm sinh</label>
            <Input
              value={formData.birthYear}
              onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })}
              placeholder="VD: 2003"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted block mb-1">Vị trí ứng tuyển</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, position: 'barista' })}
              className={`p-2.5 rounded-lg text-xs font-semibold border transition-all ${
                formData.position === 'barista'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted hover:text-foreground'
              }`}
            >
              ☕ Barista (Pha chế)
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, position: 'service' })}
              className={`p-2.5 rounded-lg text-xs font-semibold border transition-all ${
                formData.position === 'service'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted hover:text-foreground'
              }`}
            >
              ✨ Phục vụ & Thu ngân
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted block mb-1">Ca đăng ký</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'ca1', label: 'Ca 1 (6h - 14h)' },
              { id: 'ca2', label: 'Ca 2 (14h - 22h)' },
              { id: 'ca3_flexible', label: 'Ca 3 (Linh hoạt)' },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleShift(s.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${
                  formData.shifts.includes(s.id)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted hover:text-foreground'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted block mb-1">Ghi chú</label>
          <Input
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            placeholder="Kinh nghiệm, nguyện vọng ca làm..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Đang lưu...' : 'Thêm hồ sơ'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
