import { useTranslation } from 'react-i18next';
import { Card, CardBody } from '@/components/ui/card';
import type { RecruitmentApplication } from './staff-types';

interface StatsProps {
  applications: RecruitmentApplication[];
}

export function StaffRecruitmentStats({ applications }: StatsProps) {
  const { t } = useTranslation();

  const total = applications.length;
  const baristaCount = applications.filter((a) => a.position === 'barista').length;
  const serviceCount = applications.filter((a) => a.position === 'service').length;
  const pendingCount = applications.filter((a) => a.status === 'pending').length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <Card className="border border-border/60 bg-surface">
        <CardBody className="p-4">
          <p className="text-xs text-muted uppercase font-semibold tracking-wider">
            {t('adminStaff.totalApplications', 'Tổng hồ sơ')}
          </p>
          <p className="text-2xl font-bold mt-1 text-foreground">{total}</p>
        </CardBody>
      </Card>

      <Card className="border border-border/60 bg-surface">
        <CardBody className="p-4">
          <p className="text-xs text-muted uppercase font-semibold tracking-wider">
            {t('adminStaff.baristaApplicants', 'Barista (Pha chế)')}
          </p>
          <p className="text-2xl font-bold mt-1 text-amber-500">{baristaCount}</p>
        </CardBody>
      </Card>

      <Card className="border border-border/60 bg-surface">
        <CardBody className="p-4">
          <p className="text-xs text-muted uppercase font-semibold tracking-wider">
            {t('adminStaff.serviceApplicants', 'Thu ngân & Phục vụ')}
          </p>
          <p className="text-2xl font-bold mt-1 text-blue-500">{serviceCount}</p>
        </CardBody>
      </Card>

      <Card className="border border-border/60 bg-surface">
        <CardBody className="p-4">
          <p className="text-xs text-muted uppercase font-semibold tracking-wider">
            {t('adminStaff.pendingAction', 'Chờ liên hệ')}
          </p>
          <p className="text-2xl font-bold mt-1 text-rose-500">{pendingCount}</p>
        </CardBody>
      </Card>
    </div>
  );
}
