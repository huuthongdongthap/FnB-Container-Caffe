import React from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}

export default function StepBusinessName({ value, onChange, onNext }: Props) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Tên doanh nghiệp / Business name</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 p-3"
          placeholder="VD: AURA CAFE"
          autoFocus
        />
      </label>
      <button onClick={onNext} className="rounded-lg bg-blue-600 px-6 py-2 font-medium hover:bg-blue-500">
        Tiếp theo / Next
      </button>
    </div>
  );
}
