/**
 * StitchAdminLoginNew — AURA CAFE Admin Login Terminal (orchestrator)
 * States: idle, loading, error, success (all handled inline)
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export type { LoginStatus, StitchAdminLoginNewProps } from './StitchAdminLoginNew-types';
import type { LoginStatus, StitchAdminLoginNewProps } from './StitchAdminLoginNew-types';
import { BRAND } from './StitchAdminLoginNew-constants';
import { getLoginStyles } from './StitchAdminLoginNew-styles';
import { LoginHeader } from './StitchAdminLoginNew-header';
import { LoginForm } from './StitchAdminLoginNew-form';
import { LoginFooter } from './StitchAdminLoginNew-footer';

export function StitchAdminLoginNew({
  onLogin,
  status: externalStatus,
  errorMessage: externalError,
  brandName = BRAND,
}: Readonly<StitchAdminLoginNewProps>) {
  const { t } = useTranslation();
  const [internalStatus, setInternalStatus] = useState<LoginStatus>('idle');
  const [internalError, setInternalError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const status = externalStatus ?? internalStatus;
  const errorMessage = externalError ?? internalError;

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 10;
      const y = (e.clientY / window.innerHeight - 0.5) * 10;
      panel.style.transform = `perspective(1000px) rotateX(${-y}deg) rotateY(${x}deg)`;
    };
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden font-body-lg text-on-surface selection:bg-primary/30"
      style={{ backgroundColor: 'var(--aura-surface-container)' }}
      aria-label={t('adminLogin.pageAriaLabel')}
    >
      <div className="ambient-glow-login-new -top-48 -left-48" aria-hidden="true" />
      <div className="ambient-glow-login-new -bottom-48 -right-48" aria-hidden="true" />

      <LoginHeader brandName={brandName} />

      <main className="relative z-10 w-full max-w-[440px] px-4 md:px-0">
        <div
          ref={panelRef}
          className="glass-panel-login-new chrome-border-login-new rounded-lg p-10 flex flex-col items-center"
        >
          <div className="text-center mb-10">
            <h1 className="font-display-logo text-display-logo text-primary tracking-[0.3em] mb-1 uppercase">
              {brandName}
            </h1>
            <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">
              {t('adminLogin.adminTerminalAccess')}
            </p>
          </div>

          <LoginForm
            onLogin={onLogin}
            status={status}
            errorMessage={errorMessage}
            onStatusChange={setInternalStatus}
            onErrorChange={setInternalError}
          />

          <div className="w-full mt-6 text-center">
            <a
              href="#"
              className="font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors duration-300 uppercase"
              onClick={(e) => e.preventDefault()}
              aria-label={t('adminLogin.forgotPasswordAriaLabel')}
            >
              {t('adminLogin.forgotPassword', 'Quen mat khau?')}
            </a>
          </div>

          <div className="w-full chrome-line-login-new my-10" aria-hidden="true" />

          <div className="flex flex-col gap-4 w-full text-center">
            <button
              type="button"
              className="font-label-caps text-label-caps text-primary/60 hover:text-primary transition-all tracking-[0.2em] uppercase cursor-pointer"
              aria-label={t('adminLogin.guestAriaLabel')}
            >
              {t('adminLogin.enterAsGuest')}
            </button>
            <button
              type="button"
              className="font-label-caps text-label-caps text-outline hover:text-on-surface transition-all tracking-[0.2em] uppercase cursor-pointer"
              aria-label={t('adminLogin.contactSupportAriaLabel')}
            >
              {t('adminLogin.contactSupport')}
            </button>
          </div>
        </div>
      </main>

      <LoginFooter brandName={brandName} />
      <style>{getLoginStyles()}</style>
    </div>
  );
}
