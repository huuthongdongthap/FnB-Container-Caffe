'use client';

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { brandConfig } from '@/config/brand-types';
import { StitchAdminLoginNew } from '@/components/stitch';
import type { LoginStatus } from '@/components/stitch/StitchAdminLoginNew';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

interface AdminLoginProps {
  onSubmit?: (email: string, password: string) => Promise<void>;
  onSuccess?: () => void;
  error?: string | null;
}

export default function AdminLogin({ onSubmit, onSuccess, error: externalError }: Readonly<AdminLoginProps>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [lastError, setLastError] = useState<string | undefined>();

  const handleLogin = useCallback(async (email: string, password: string) => {
    setStatus('loading');
    setLastError(undefined);
    try {
      if (onSubmit) {
        await onSubmit(email, password);
      } else {
        await useAuthStore.getState().login(email, password);
        const currentUser = useAuthStore.getState().user;
        if (!currentUser) {
          const authError = useAuthStore.getState().error || t('adminLogin.loginFailed');
          throw new Error(authError);
        }
      }
      const loggedInUser = useAuthStore.getState().user;
      const role = loggedInUser?.role?.toLowerCase() ?? '';
      const defaultTarget = ['kitchen', 'barista', 'chef', 'bep'].includes(role)
        ? '/kds'
        : role === 'cashier'
          ? '/admin/pos'
          : ['shipper', 'rider', 'staff', 'waiter'].includes(role)
            ? '/mobile/orders'
            : '/admin';
      onSuccess ? onSuccess() : navigate(defaultTarget);
      setStatus('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('adminLogin.loginFailed');
      setLastError(msg);
      setStatus('error');
    }
  }, [onSubmit, onSuccess, navigate, t]);

  const isDemoGuestEnabled = import.meta.env.VITE_ENABLE_DEMO_GUEST === 'true';

  const handleGuestLogin = useCallback(async () => {
    if (!isDemoGuestEnabled) return;
    setStatus('loading');
    setLastError(undefined);
    const demoEmail = import.meta.env.VITE_DEMO_ADMIN_EMAIL;
    const demoPassword = import.meta.env.VITE_DEMO_ADMIN_PASSWORD;
    if (!demoEmail || !demoPassword) {
      setLastError(t('adminLogin.loginFailed'));
      setStatus('error');
      return;
    }
    try {
      await useAuthStore.getState().login(demoEmail, demoPassword);
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) {
        throw new Error(useAuthStore.getState().error || t('adminLogin.loginFailed'));
      }
      setStatus('success');
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/admin');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('adminLogin.loginFailed');
      setLastError(msg);
      setStatus('error');
    }
  }, [isDemoGuestEnabled, navigate, onSuccess, t]);

  return (
    <StitchAdminLoginNew
      onLogin={handleLogin}
      onGuestLogin={isDemoGuestEnabled ? handleGuestLogin : undefined}
      forgotPasswordHref="/forgot-password"
      status={status}
      errorMessage={lastError ?? externalError ?? undefined}
      brandName={brandConfig.brand.nameShort}
    />
  );
}
