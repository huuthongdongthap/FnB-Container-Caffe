import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { CheckinRow } from '@/components/admin/checkin-row';
import { useCheckinApprovals } from './CheckinApprove-hooks';
import { CheckinDetailPanel } from './CheckinApprove-detail-panel';
import { CheckinHistoryList } from './CheckinApprove-history-list';

export type { PendingCheckin } from './CheckinApprove-types';
export { MOCK_CHECKINS } from './CheckinApprove-constants';
export { formatRelativeTime } from './CheckinApprove-utils';
export { useCheckinApprovals } from './CheckinApprove-hooks';
export { CheckinDetailPanel } from './CheckinApprove-detail-panel';
export { CheckinHistoryList } from './CheckinApprove-history-list';

export default function AdminCheckinApprovePage() {
  const { t } = useTranslation('checkinApprove');
  const {
    selectedCheckin,
    setSelectedCheckin,
    loading,
    error,
    actingId,
    pendingCheckins,
    completedCheckins,
    fetchPendingCheckins,
    handleApprove,
    handleReject,
  } = useCheckinApprovals();

  return (
    <>
      <HelmetHead
        title="Duyệt Check-in — Check-in Approval — AURA CAFE"
        description="Duyệt yêu cầu check-in từ thành viên tại AURA CAFE. Approve or reject member check-in requests."
      />
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-display font-bold">
              {t('title')}
            </h1>
            <Badge variant="warning">
              {t('pendingCount', { count: pendingCheckins.length })}
            </Badge>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">
              {error}
              <button onClick={fetchPendingCheckins} className="ml-3 underline hover:no-underline">
                {t('retry')}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pending */}
            <div>
              <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
                {t('pendingTitle')}
              </h2>
              {loading ? (
                <div className="text-center py-8 text-muted text-sm">{t('loading')}</div>
              ) : (
                <div className="space-y-3">
                  {pendingCheckins.length === 0 ? (
                    <p className="text-sm text-muted text-center py-8">
                      {t('noPendingRequests')}
                    </p>
                  ) : (
                    pendingCheckins.map((checkin) => (
                      <CheckinRow
                        key={checkin.id}
                        checkin={checkin}
                        isSelected={selectedCheckin?.id === checkin.id}
                        onClick={() => setSelectedCheckin(checkin)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Detail / Action */}
            <div>
              <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
                {selectedCheckin ? t('detailTitle') : t('selectRequest')}
              </h2>
              <CheckinDetailPanel
                checkin={selectedCheckin}
                actingId={actingId}
                onApprove={handleApprove}
                onReject={handleReject}
                t={t}
              />
            </div>
          </div>

          <CheckinHistoryList checkins={completedCheckins} t={t} />
        </div>
      </div>
    </>
  );
}
