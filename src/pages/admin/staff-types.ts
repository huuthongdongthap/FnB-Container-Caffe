export type StaffTab = 'list' | 'shifts' | 'recruitment';

export interface RecruitmentApplication {
  id: string;
  fullName: string;
  phone: string;
  birthYear?: string;
  position: 'barista' | 'service' | string;
  shifts: string[];
  experience: string;
  note?: string;
  status: 'pending' | 'contacted' | 'interview' | 'hired' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

