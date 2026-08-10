import React from 'react';

const CONTAINER_SIZES = [
  { id: '10ft', label: '10ft', desc: 'Phù hợp cửa hàng nhỏ / Small shop' },
  { id: '20ft', label: '20ft', desc: 'Phù hợp quán cafe / Cafe space' },
  { id: '40ft', label: '40ft', desc: 'Không gian lớn / Large space' },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}

export default function StepContainerSize({ value, onChange, onNext }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {CONTAINER_SIZES.map((cs) => (
          <button
            key={cs.id}
            onClick={() => onChange(cs.id)}
            className={`rounded-xl border p-6 text-center transition ${
              value === cs.id ? 'border-blue-500 bg-blue-500/20' : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <div className="text-3xl font-display font-bold">{cs.label}</div>
            <div className="mt-2 text-xs text-gray-400">{cs.desc}</div>
          </button>
        ))}
      </div>
      <div>
        <button
          onClick={onNext}
          disabled={!value}
          className="rounded-lg bg-blue-600 px-6 py-2 font-medium disabled:opacity-40"
        >
          Tiếp theo / Next
        </button>
      </div>
    </div>
  );
}
