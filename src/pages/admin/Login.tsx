'use client';

import { useState, useCallback } from 'react';
import { brandConfig } from '@/config/brand-types';
import { StitchAdminLoginNew } from '@/components/stitch';
import type { LoginStatus } from '@/components/stitch/StitchAdminLoginNew';

interface AdminLoginProps {
  onSubmit?: (email: string, password: string) => Promise<void>;
  onSuccess?: () => void;
  error?: string | null;
}

export default function AdminLogin({ onSubmit, onSuccess, error: externalError }: Readonly<AdminLoginProps>) {
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [lastError, setLastError] = useState<string | undefined>();

  const handleLogin = useCallback(async (email: string, password: string) => {
    if (!onSubmit) return;
    setStatus('loading');
    setLastError(undefined);
    try {
      await onSubmit(email, password);
      onSuccess?.();
      setStatus('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Đăng nhập thất bại';
      setLastError(msg);
      setStatus('error');
    }
  }, [onSubmit, onSuccess]);

  return (
    <StitchAdminLoginNew
      onLogin={onSubmit ? handleLogin : undefined}
      status={onSubmit ? status : undefined}
      errorMessage={lastError ?? externalError ?? undefined}
      brandName={brandConfig.brand.nameShort}
    />
  );
}
