import React, { useState, useEffect } from 'react';
import StepBusinessName from '@/components/saas/onboarding-wizard/step-business-name';
import StepContainerSize from '@/components/saas/onboarding-wizard/step-container-size';
import StepZoneSelection from '@/components/saas/onboarding-wizard/step-zone';
import StepConfirmation from '@/components/saas/onboarding-wizard/step-confirm';
import { apiFetch } from '@/lib/api-client';

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [containerSize, setContainerSize] = useState('');
  const [zone, setZone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('aura_tenant_id') : null;
  useEffect(() => {
    if (!tenantId) {
      window.location.href = '/saas/onboard/tenant';
    }
  }, [tenantId]);

  function goNext() {
    setError('');
    if (step === 1 && businessName.trim().length < 2) {
      setError('Tên cần ≥ 2 ký tự');
      return;
    }
    if (step === 2 && !containerSize) {
      setError('Vui lòng chọn kích thước container');
      return;
    }
    if (step === 3 && !zone) {
      setError('Vui lòng chọn zone');
      return;
    }
    setStep((s) => s + 1);
  }

  async function handleFinish() {
    setLoading(true);
    setError('');
    try {
      const plansRaw = await apiFetch<{ data?: Array<Record<string, unknown>> }>('/api/subscriptions/plans');
      const plansArr = Array.isArray(plansRaw) ? plansRaw : (plansRaw.data || []);
      const plan = plansArr.find((p: Record<string, unknown>) => String(p.container_size) === containerSize) || plansArr[0];

      if (!plan) {
        setError('Không tìm thấy gói phù hợp. Vui lòng liên hệ hỗ trợ.');
        setLoading(false);
        return;
      }

      const subRes = await apiFetch<{ error?: string; message?: string }>('/api/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: (plan as { id: string }).id,
          customer_name: businessName,
          customer_email: '',
          customer_phone: '',
          container_number: `${zone}-${containerSize}`,
          zone,
          ...(tenantId ? { tenant_id: tenantId } : {}),
        }),
      });

      if ((subRes as { error?: string }).error || (subRes as { message?: string }).message) {
        setError((subRes as { error?: string }).error || (subRes as { message?: string }).message || 'Tạo subscription thất bại');
        setLoading(false);
        return;
      }

      window.location.href = '/saas/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối');
      setLoading(false);
    }
  }

  return (
    <div className="bg-[color:var(--aura-noir-deep)] text-[color:var(--aura-chrome-bright)] mx-auto max-w-2xl px-4 py-24">
      <h1 className="font-display text-2xl font-bold">Onboarding / Thiết lập ban đầu</h1>
      <div className="mt-2 flex gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={`h-1 flex-1 rounded ${s <= step ? 'bg-blue-500' : 'bg-gray-700'}`} />
        ))}
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-900/30 p-3 text-sm text-red-300">{error}</div>}

      {step === 1 && (
        <StepBusinessName value={businessName} onChange={setBusinessName} onNext={goNext} />
      )}
      {step === 2 && (
        <StepContainerSize value={containerSize} onChange={setContainerSize} onNext={goNext} />
      )}
      {step === 3 && (
        <StepZoneSelection value={zone} onChange={setZone} onNext={goNext} />
      )}
      {step === 4 && (
        <StepConfirmation
          businessName={businessName}
          containerSize={containerSize}
          zone={zone}
          loading={loading}
          onConfirm={handleFinish}
        />
      )}
    </div>
  );
}
