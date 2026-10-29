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
      const defaultTarget = loggedInUser && ['kitchen', 'barista', 'chef', 'bep'].includes(loggedInUser.role)
        ? '/kds'
        : '/admin';
      onSuccess ? onSuccess() : navigate(defaultTarget);
      setStatus('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('adminLogin.loginFailed');
      setLastError(msg);
      setStatus('error');
    }
  }, [onSubmit, onSuccess, navigate, t]);

  const handleGuestLogin = useCallback(() => {
    if (!import.meta.env.DEV && import.meta.env.MODE !== 'test') {
      setLastError(t('adminLogin.loginFailed'));
      setStatus('error');
      return;
    }
    useAuthStore.setState({
      user: {
        id: 'guest-admin',
        name: 'Demo Manager',
        email: 'admin@auracafe.vn',
        role: 'owner',
      },
      loading: false,
      error: null,
    });
    if (onSuccess) {
      onSuccess();
    } else {
      navigate('/admin');
    }
  }, [navigate, onSuccess, t]);

  return (
    <StitchAdminLoginNew
      onLogin={handleLogin}
      onGuestLogin={import.meta.env.DEV || import.meta.env.MODE === 'test' ? handleGuestLogin : undefined}
      status={status}
      errorMessage={lastError ?? externalError ?? undefined}
      brandName={brandConfig.brand.nameShort}
    />
  );
}
