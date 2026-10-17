import { create } from 'zustand';
import { apiFetch } from '@/lib/api-client';
import type { RecruitmentApplication } from '@/pages/admin/staff-types';

interface RecruitmentFilters {
  status?: string;
  position?: string;
  search?: string;
}

interface AdminRecruitmentState {
  applications: RecruitmentApplication[];
  loading: boolean;
  error: string | null;
  fetchApplications: (filters?: RecruitmentFilters) => Promise<void>;
  updateStatus: (id: string, status: RecruitmentApplication['status']) => Promise<void>;
  deleteApplication: (id: string) => Promise<void>;
  addCandidate: (candidate: {
    fullName: string;
    phone: string;
    birthYear?: string;
    position: 'barista' | 'service';
    shifts: string[];
    experience: string;
    note?: string;
  }) => Promise<void>;
}

function getLocalApplications(): RecruitmentApplication[] {
  try {
    const raw = localStorage.getItem('aura_recruitment_applications');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: Record<string, unknown>) => ({
      id: String(item.id || `APP_${Date.now()}`),
      fullName: String(item.fullName || item.name || 'Ứng viên'),
      phone: String(item.phone || ''),
      birthYear: String(item.birthYear || ''),
      position: (item.position as RecruitmentApplication['position']) || 'barista',
      shifts: Array.isArray(item.shifts) ? (item.shifts as string[]) : [],
      experience: String(item.experience || 'none'),
      note: String(item.note || ''),
      status: (item.status as RecruitmentApplication['status']) || 'pending',
      createdAt: String(item.submittedAt || item.createdAt || new Date().toISOString()),
      updatedAt: String(item.updatedAt || new Date().toISOString()),
    }));
  } catch {
    return [];
  }
}

export const useAdminRecruitmentStore = create<AdminRecruitmentState>((set, get) => ({
  applications: [],
  loading: false,
  error: null,

  fetchApplications: async (filters) => {
    set({ loading: true, error: null });

    const localApps = getLocalApplications();

    try {
      const params = new URLSearchParams();
      if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters?.position && filters.position !== 'all') params.append('position', filters.position);
      if (filters?.search) params.append('search', filters.search);

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const response = await apiFetch<{ success: boolean; data: RecruitmentApplication[] }>(
        `/api/recruitment/applications${queryStr}`,
        { silent: true }
      );

      const serverApps = response?.data || [];
      // Merge unique by ID (server takes precedence)
      const mergedMap = new Map<string, RecruitmentApplication>();
      serverApps.forEach((app) => mergedMap.set(app.id, app));
      localApps.forEach((app) => {
        if (!mergedMap.has(app.id)) mergedMap.set(app.id, app);
      });

      let results = Array.from(mergedMap.values());

      // Filter locally if any filter was active
      if (filters?.status && filters.status !== 'all') {
        results = results.filter((a) => a.status === filters.status);
      }
      if (filters?.position && filters.position !== 'all') {
        results = results.filter((a) => a.position === filters.position);
      }
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        results = results.filter(
          (a) => a.fullName.toLowerCase().includes(q) || a.phone.includes(q)
        );
      }

      set({ applications: results, loading: false, error: null });
    } catch {
      // Graceful fallback to local storage
      let results = localApps;
      if (filters?.status && filters.status !== 'all') {
        results = results.filter((a) => a.status === filters.status);
      }
      if (filters?.position && filters.position !== 'all') {
        results = results.filter((a) => a.position === filters.position);
      }
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        results = results.filter(
          (a) => a.fullName.toLowerCase().includes(q) || a.phone.includes(q)
        );
      }
      set({ applications: results, loading: false, error: null });
    }
  },

  updateStatus: async (id, status) => {
    // Optimistic UI update
    set((state) => ({
      applications: state.applications.map((app) =>
        app.id === id ? { ...app, status, updatedAt: new Date().toISOString() } : app
      ),
    }));

    // Update localStorage
    try {
      const local = getLocalApplications();
      const updated = local.map((app) =>
        app.id === id ? { ...app, status, updatedAt: new Date().toISOString() } : app
      );
      localStorage.setItem('aura_recruitment_applications', JSON.stringify(updated));
    } catch {
      // Ignore local storage error
    }

    try {
      await apiFetch(`/api/recruitment/applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        silent: true,
      });
    } catch {
      // Server update failure handled gracefully via optimistic update
    }
  },

  deleteApplication: async (id) => {
    // Optimistic remove
    set((state) => ({
      applications: state.applications.filter((app) => app.id !== id),
    }));

    try {
      const local = getLocalApplications().filter((app) => app.id !== id);
      localStorage.setItem('aura_recruitment_applications', JSON.stringify(local));
    } catch {
      // Ignore
    }

    try {
      await apiFetch(`/api/recruitment/applications/${id}`, {
        method: 'DELETE',
        silent: true,
      });
    } catch {
      // Handled
    }
  },

  addCandidate: async (candidate) => {
    let serverId: string | undefined;
    try {
      const res = await apiFetch<{ id?: string; data?: { id?: string } }>('/api/recruitment/apply', {
        method: 'POST',
        body: JSON.stringify(candidate),
        silent: true,
      });
      serverId = res?.id ?? res?.data?.id;
    } catch {
      // Local addition remains when offline
    }

    const newApp: RecruitmentApplication = {
      id: serverId ?? `APP_${Date.now()}`,
      ...candidate,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      applications: [newApp, ...state.applications],
    }));

    try {
      const local = [newApp, ...getLocalApplications()];
      localStorage.setItem('aura_recruitment_applications', JSON.stringify(local.slice(0, 50)));
    } catch {
      // Ignore
    }
  },
}));
