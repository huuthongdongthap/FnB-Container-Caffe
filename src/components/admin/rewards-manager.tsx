import { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { useClientSessionScope } from '@/lib/client-session';
import { requireConfirmation, submissionError } from '@/lib/server-confirmed-submission';

type Reward = { id: string; name: string; description?: string; pointsCost: number; type: string; value: number; isActive: boolean };
const REWARD_TYPES = ['discount', 'free_item', 'upgrade', 'experience', 'merchandise', 'voucher', 'free_drink', 'percent'];

export function RewardsManager() {
  const { role } = useClientSessionScope();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [type, setType] = useState('discount');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const allowed = ['owner', 'manager', 'admin'].includes(role ?? '');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    apiFetch<{ success: boolean; data: { rewards: Reward[] } }>('/api/loyalty/rewards?limit=100').then(body => {
      if (body.success !== true || !Array.isArray(body.data?.rewards)) throw new Error('Danh sách phần thưởng không hợp lệ / Invalid rewards');
      if (active) setRewards(body.data.rewards);
    }).catch(failure => { if (active) setError(submissionError(failure)); });
    return () => { active = false; };
  }, [reload]);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!allowed || busy || !name.trim() || !Number.isSafeInteger(Number(cost)) || Number(cost) < 1 || !Number.isFinite(Number(value)) || Number(value) < 0) return;
    setBusy(true); setError('');
    try {
      const response = await apiFetch('/api/loyalty/rewards', { method: 'POST', body: JSON.stringify({ name: name.trim(), pointsCost: Number(cost), type, value: Number(value), isActive: true }) });
      requireConfirmation(response);
      setName(''); setCost(''); setValue(''); setReload(v => v + 1);
    } catch (failure) { setError(submissionError(failure)); }
    finally { setBusy(false); }
  }
  async function toggle(reward: Reward) {
    if (!allowed || busy) return;
    setBusy(true); setError('');
    try {
      const response = await apiFetch(`/api/loyalty/rewards/${encodeURIComponent(reward.id)}`, { method: 'PATCH', body: JSON.stringify({ isActive: !reward.isActive }) });
      requireConfirmation(response); setReload(v => v + 1);
    } catch (failure) { setError(submissionError(failure)); }
    finally { setBusy(false); }
  }
  return <section className="mt-6 space-y-4 rounded-xl border border-border bg-surface p-4" aria-label="Quản trị phần thưởng / Reward management">
    <h2 className="flex items-center gap-2 text-lg"><Gift size={18} aria-hidden="true" /> Phần thưởng / Rewards</h2>
    {error && <p role="alert">{error}</p>}
    <ul className="space-y-2">{rewards.map(reward => <li key={reward.id} className="flex items-center justify-between border-b border-border p-2"><span>{reward.name} · {reward.pointsCost} điểm / points · {reward.type} · {reward.isActive ? 'Đang bật / Active' : 'Đã tắt / Inactive'}</span>{allowed && <button type="button" disabled={busy} onClick={() => void toggle(reward)} className="underline">{reward.isActive ? 'Tắt / Deactivate' : 'Bật / Activate'}</button>}</li>)}</ul>
    {allowed && <form onSubmit={create} className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
      <label>Tên / Name<input className="block w-full bg-background p-2" required maxLength={100} value={name} disabled={busy} onChange={e => setName(e.target.value)} /></label>
      <label>Điểm đổi / Points cost<input className="block w-full bg-background p-2" type="number" min="1" step="1" required value={cost} disabled={busy} onChange={e => setCost(e.target.value)} /></label>
      <label>Loại / Type<select className="block w-full bg-background p-2" value={type} disabled={busy} onChange={e => setType(e.target.value)}>{REWARD_TYPES.map(option => <option key={option}>{option}</option>)}</select></label>
      <label>Giá trị / Value<input className="block w-full bg-background p-2" type="number" min="0" step="any" required value={value} disabled={busy} onChange={e => setValue(e.target.value)} /></label>
      <button type="submit" disabled={busy || !name.trim() || Number(cost) < 1 || !value} className="rounded border border-border p-2 disabled:opacity-50 sm:col-span-2">Tạo phần thưởng / Create reward</button>
    </form>}
  </section>;
}
