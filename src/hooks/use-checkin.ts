import { useState, useCallback, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api-client';

export interface MemberInfo {
  member_id: string;
  name: string;
  phone: string;
}

export interface CampaignInfo {
  reward_type: string;
  [key: string]: unknown;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  message?: string;
  campaign?: CampaignInfo;
  member?: MemberInfo;
  existing?: {
    reward_type: string;
  };
}

export interface CheckinState {
  step: 1 | 2 | 3 | 4 | 5;
  phone: string;
  member: MemberInfo | null;
  eligibility: EligibilityResult | null;
  isPolling: boolean;
  isSubmitted: boolean;
}

interface CheckinResult {
  state: CheckinState;
  lookupPhone: (phone: string) => Promise<void>;
  markPosted: () => void;
  reset: () => void;
  isLoading: boolean;
  error: string | null;
}

export function useCheckin(): CheckinResult {
  const [state, setState] = useState<CheckinState>({
    step: 1,
    phone: '',
    member: null,
    eligibility: null,
    isPolling: false,
    isSubmitted: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lookupPhone = useCallback(async (phone: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Lookup customer
      const lookupRes = await apiFetch<{ success: boolean; member: MemberInfo }>(
        `/api/loyalty/lookup?phone=${encodeURIComponent(phone)}`
      );

      if (!lookupRes.success || !lookupRes.member) {
        setError('Không tìm thấy số điện thoại trong hệ thống');
        setIsLoading(false);
        return;
      }

      // Check eligibility
      const eligRes = await apiFetch<EligibilityResult>(
        `/api/loyalty/checkin/eligibility/${lookupRes.member.member_id}`
      );

      setState((prev) => ({
        ...prev,
        step: eligRes.eligible ? 3 : 2,
        phone,
        member: lookupRes.member,
        eligibility: eligRes,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markPosted = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: 4,
      isPolling: true,
    }));

    // Start polling for approval (every 5s)
    pollRef.current = setInterval(async () => {
      const currentMember = state.member;
      if (!currentMember) return;

      try {
        const res = await apiFetch<EligibilityResult>(
          `/api/loyalty/checkin/eligibility/${currentMember.member_id}`
        );

        if (!res.eligible && res.reason === 'already_checked_in_this_month' && res.existing) {
          if (pollRef.current) clearInterval(pollRef.current);
          setState((prev) => ({
            ...prev,
            step: 5,
            isPolling: false,
            isSubmitted: true,
            eligibility: res,
          }));
        }
      } catch {
        // Silently retry on next interval
      }
    }, 5000);
  }, [state.member]);

  const reset = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setState({
      step: 1,
      phone: '',
      member: null,
      eligibility: null,
      isPolling: false,
      isSubmitted: false,
    });
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  return {
    state,
    lookupPhone,
    markPosted,
    reset,
    isLoading,
    error,
  };
}
