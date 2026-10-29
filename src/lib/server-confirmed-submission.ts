import { useSyncExternalStore } from 'react';
import { readClientSession, subscribeClientSession } from '@/lib/client-session';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

/** Memory only: a failed unchanged submission retains its key until retry succeeds. */
export function createSubmissionKey() {
  let fingerprint = '';
  let key = '';
  return {
    forPayload(payload: unknown) {
      const next = JSON.stringify(payload);
      if (!key || next !== fingerprint) {
        fingerprint = next;
        key = crypto.randomUUID();
      }
      return key;
    },
    clear() { fingerprint = ''; key = ''; },
  };
}

// Match createPrivateStore's identity: publishing the same session is not a new operator.
const sessionIdentity = () => {
  const { token, user } = readClientSession();
  return `${token || ''}:${user?.id || ''}:${user?.tenantId || ''}:${user?.role || ''}`;
};
let identity = sessionIdentity();
let sessionVersion = 0;
if (typeof window !== 'undefined') subscribeClientSession(() => {
  const next = sessionIdentity();
  if (next !== identity) { identity = next; sessionVersion++; }
});
export const submissionSession = () => sessionVersion;
const subscribeSubmission = (listener: () => void) => subscribeClientSession(() => listener());
export const useSubmissionSession = () => useSyncExternalStore(subscribeSubmission, submissionSession, () => 0);
export const recruitmentAllowed = () => ['owner', 'manager'].includes(useAuthStore.getState().user?.role || '');
export function requireConfirmation(body: unknown): asserts body is Record<string, unknown> {
  if (!body || typeof body !== 'object' || (body as Record<string, unknown>).success !== true) {
    throw new Error('Máy chủ chưa xác nhận đã lưu. Vui lòng thử lại.');
  }
}
export function confirmedRecord(body: unknown): Record<string, unknown> {
  requireConfirmation(body);
  const raw = body.data ?? body.customer ?? body;
  const id = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).id : undefined;
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('Máy chủ chưa trả mã bản ghi đã lưu. Vui lòng thử lại.');
  }
  return raw as Record<string, unknown>;
}
export const submissionError = (error: unknown) => error instanceof Error ? error.message : 'Không thể kết nối máy chủ. Vui lòng thử lại.';
