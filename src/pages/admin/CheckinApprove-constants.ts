import type { PendingCheckin } from './CheckinApprove-types';

export const MOCK_CHECKINS: PendingCheckin[] = [
  {
    id: 'C001',
    memberId: 'M001',
    memberName: 'Nguyen Van A',
    memberPhone: '0901234567',
    photoUrl: '',
    submittedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    status: 'pending',
  },
  {
    id: 'C002',
    memberId: 'M002',
    memberName: 'Tran Thi B',
    memberPhone: '0912345678',
    submittedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    status: 'pending',
  },
  {
    id: 'C003',
    memberId: 'M003',
    memberName: 'Le Van C',
    memberPhone: '0987654321',
    submittedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    status: 'pending',
  },
];
