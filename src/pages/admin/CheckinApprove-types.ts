export interface PendingCheckin {
  id: string;
  memberId: string;
  memberName: string;
  memberPhone: string;
  photoUrl?: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}
