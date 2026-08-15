import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/* ── Invalid QR Error Page ─────────────────────────────────────────── */

export function InvalidQRPage({ submitError }: { submitError: string | null }) {
  const { t } = useTranslation('order');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[color:var(--aura-noir-deep)] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div
          className="rounded-2xl p-6 mb-5"
          style={{
            background: 'rgba(255,100,100,0.08)',
            border: '1px solid rgba(255,100,100,0.25)',
          }}
        >
          <p className="text-[13px] font-body text-[var(--aura-chrome-bright)] uppercase tracking-widest">
            {t('invalidQRLabel', { defaultValue: 'Lỗi' })}
          </p>
          <p className="mt-3 text-[15px] font-body text-[#ffb4ab]">
            {submitError ??
              t('invalidQR', { defaultValue: 'Mã QR không hợp lệ.' })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-full px-6 py-3 text-[13px] font-body font-semibold uppercase tracking-wider bg-[var(--aura-chrome-mid)] text-white active:scale-95 transition-transform"
        >
          {t('backHome', { defaultValue: 'Về trang chủ' })}
        </button>
      </div>
    </div>
  );
}

/* ── Guest Info Form (Table mode) ──────────────────────────────────── */

interface GuestInfoFormProps {
  guestName: string;
  guestPhone: string;
  isSubmitting: boolean;
  submitError: string | null;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
}

export function GuestInfoForm({
  guestName,
  guestPhone,
  isSubmitting,
  submitError,
  onNameChange,
  onPhoneChange,
}: GuestInfoFormProps) {
  const { t } = useTranslation('order');

  return (
    <div
      className="fixed left-0 right-0 z-40 px-5 pt-3 pb-3"
      style={{
        top: '3rem',
        background: 'rgba(10,26,46,0.7)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '0.5px solid rgba(229,228,226,0.15)',
      }}
    >
      <div className="flex gap-3">
        <input
          type="text"
          value={guestName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t('guestName', { defaultValue: 'Tên của bạn' })}
          disabled={isSubmitting}
          className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-[13px] font-body bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-[var(--aura-text-primary, #e8e8e8)] placeholder:text-[var(--aura-text-secondary, #a0a8b0)] focus:outline-none focus:border-[rgba(198,198,199,0.3)] focus:ring-1 focus:ring-[rgba(198,198,199,0.1)] transition-all disabled:opacity-50"
        />
        <input
          type="tel"
          inputMode="numeric"
          value={guestPhone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder={t('guestPhone', { defaultValue: 'Số điện thoại' })}
          disabled={isSubmitting}
          className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-[13px] font-body bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-[var(--aura-text-primary, #e8e8e8)] placeholder:text-[var(--aura-text-secondary, #a0a8b0)] focus:outline-none focus:border-[rgba(198,198,199,0.3)] focus:ring-1 focus:ring-[rgba(198,198,199,0.1)] transition-all disabled:opacity-50"
        />
      </div>

      {submitError && (
        <p
          className="mt-2 text-[12px] text-[#ffb4ab] font-body"
          role="alert"
        >
          {submitError}
        </p>
      )}
    </div>
  );
}

/* ── Offline Indicator Banner ───────────────────────────────────────── */

export function OfflineIndicator() {
  const { t } = useTranslation('order');

  return (
    <div
      className="fixed bottom-24 left-4 right-4 z-40 rounded-xl px-4 py-3 text-center text-[12px] font-body"
      style={{
        background: 'rgba(255,183,77,0.15)',
        border: '1px solid rgba(255,183,77,0.4)',
        color: '#ffb74d',
      }}
      role="status"
    >
      {t('offlineIndicator', {
        defaultValue:
          'Đang offline — đơn hàng sẽ tự động gửi khi có mạng.',
      })}
    </div>
  );
}
