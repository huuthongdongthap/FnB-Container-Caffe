import { useEffect } from 'react';
import { useCheckinStore } from '@/hooks/stores/use-checkin-store';
import { CheckinForm } from '@/components/checkin/CheckinForm';
import { ApprovalStatus } from '@/components/checkin/ApprovalStatus';
import { Button } from '@/components/ui/button';

export default function CheckinPage() {
  const {
    checkinResult,
    loading,
    error,
    submitCheckin,
    reset,
  } = useCheckinStore();

  // wire store result into page-level state
  const handlePhoneSubmit = async (phone: string) => {
    await submitCheckin(phone);
  };

  const stateStep = checkinResult ? 5 : 1;

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold">AURA</h1>
          <p className="text-xs text-muted uppercase tracking-widest">
            CONTAINER ROOFTOP &middot; SA D&Eacute;C
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        {/* Step 1: Enter phone */}
        {stateStep === 1 && !checkinResult && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">1</span>
              <div>
                <h2 className="font-display text-lg font-semibold">Nhập số điện thoại</h2>
                <p className="text-xs text-muted">Để hệ thống tra cứu tài khoản thành viên của bạn</p>
              </div>
            </div>
            <CheckinForm
              onSubmit={handlePhoneSubmit}
            />
            <p className="text-center text-xs text-muted mt-4">
              Chưa là thành viên?{' '}
              <a href="/signup" className="text-accent-warm hover:underline">
                Đăng ký ngay
              </a>
            </p>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted py-8">
            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Đang xử lý...
          </div>
        )}

        {/* Step 5: Success */}
        {stateStep === 5 && checkinResult && (
          <div>
            <div className="p-6 rounded-xl border-2 border-green-500 text-center">
              <div className="text-5xl mb-3">&#127881;</div>
              <h2 className="font-display text-xl font-bold mb-2">Cảm ơn bạn đã check-in!</h2>
              {checkinResult.points > 0 && (
                <div>
                  <p className="text-2xl font-bold text-green-600">+{checkinResult.points.toLocaleString()}đ</p>
                  <p className="text-sm text-muted">Đã cộng vào ví AURA của bạn</p>
                </div>
              )}
              {checkinResult.reward && checkinResult.points === 0 && (
                <div>
                  <p className="text-2xl font-bold text-green-600">{checkinResult.reward}</p>
                </div>
              )}
              {checkinResult.points === 0 && !checkinResult.reward && (
                <p className="text-sm text-muted">Check-in thành công!</p>
              )}
            </div>
            <Button className="w-full mt-4" onClick={reset}>
              Đóng
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
