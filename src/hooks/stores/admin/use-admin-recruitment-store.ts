import { createPrivateStore as create } from '@/lib/create-private-store';
import { apiFetch } from '@/lib/api-client';
import { confirmedRecord, createSubmissionKey, recruitmentAllowed, requireConfirmation, submissionError, submissionSession } from '@/lib/server-confirmed-submission';
import type { RecruitmentApplication } from '@/pages/admin/staff-types';

interface RecruitmentFilters { status?: string; position?: string; search?: string }
export interface CandidateInput {
  fullName: string; phone: string; birthYear?: string; position: 'barista' | 'service';
  shifts: string[]; experience: string; note?: string;
}
interface AdminRecruitmentState {
  applications: RecruitmentApplication[];
  loading: boolean;
  pending: Record<string, boolean>;
  error: string | null;
  fetchApplications: (filters?: RecruitmentFilters) => Promise<void>;
  updateStatus: (id: string, status: RecruitmentApplication['status']) => Promise<boolean>;
  deleteApplication: (id: string) => Promise<boolean>;
  addCandidate: (candidate: CandidateInput, requestKey?: string) => Promise<boolean>;
}

export const useAdminRecruitmentStore = create<AdminRecruitmentState>((set, get) => {
  const createKey = createSubmissionKey();
  let readVersion = 0;
  let mutationVersion = 0;
  const mutate = async (entity: string, request: () => Promise<unknown>, apply: (body: unknown) => void) => {
    if (!recruitmentAllowed()) { set({ error: 'Bạn không có quyền quản lý tuyển dụng.', applications: [] }); return false; }
    if (get().pending[entity]) return false;
    const session = submissionSession();
    mutationVersion++;
    set(state => ({ pending: { ...state.pending, [entity]: true }, error: null }));
    try {
      const body = await request();
      if (session !== submissionSession()) return false;
      apply(body);
      return true;
    } catch (error) {
      if (session === submissionSession()) set({ error: `Chưa xác nhận đã lưu. ${submissionError(error)}` });
      return false;
    } finally {
      if (session === submissionSession()) {
        mutationVersion++;
        set(state => ({ pending: { ...state.pending, [entity]: false }, loading: false }));
      }
    }
  };
  return {
    applications: [], loading: false, pending: {}, error: null,
    fetchApplications: async filters => {
      if (!recruitmentAllowed()) { set({ applications: [], loading: false, error: 'Bạn không có quyền quản lý tuyển dụng.' }); return; }
      const read = ++readVersion;
      const mutation = mutationVersion;
      const session = submissionSession();
      set({ loading: true, error: null });
      try {
        const params = new URLSearchParams();
        if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
        if (filters?.position && filters.position !== 'all') params.set('position', filters.position);
        if (filters?.search) params.set('search', filters.search);
        const response = await apiFetch<{ success: boolean; data: RecruitmentApplication[] }>(`/api/recruitment/applications${params.size ? `?${params}` : ''}`, { silent: true });
        if (session !== submissionSession() || read !== readVersion || mutation !== mutationVersion || Object.values(get().pending).some(Boolean)) return;
        requireConfirmation(response);
        if (!Array.isArray(response.data)) throw new Error('Danh sách hồ sơ không hợp lệ.');
        set({ applications: response.data, loading: false, error: null });
      } catch (error) {
        if (session === submissionSession() && read === readVersion && mutation === mutationVersion) set({ loading: false, error: submissionError(error) });
      } finally {
        if (session === submissionSession() && read === readVersion) set({ loading: false });
      }
    },
    updateStatus: async (id, status) => mutate(id, () => apiFetch(`/api/recruitment/applications/${id}`, {
      method: 'PATCH', body: JSON.stringify({ status }), silent: true,
    }), body => {
      requireConfirmation(body);
      set(state => ({ applications: state.applications.map(app => app.id === id ? { ...app, status } : app) }));
    }),
    deleteApplication: async id => mutate(id, () => apiFetch(`/api/recruitment/applications/${id}`, { method: 'DELETE', silent: true }), body => {
      requireConfirmation(body);
      set(state => ({ applications: state.applications.filter(app => app.id !== id) }));
    }),
    addCandidate: async (candidate, requestKey) => mutate('create', () => apiFetch('/api/recruitment/applications', {
      method: 'POST', body: JSON.stringify(candidate), silent: true,
      headers: { 'Idempotency-Key': requestKey || createKey.forPayload(candidate) },
    }), body => {
      const app = confirmedRecord(body) as unknown as RecruitmentApplication;
      set(state => ({ applications: [app, ...state.applications.filter(item => item.id !== app.id)] }));
      createKey.clear();
    }),
  };
});
