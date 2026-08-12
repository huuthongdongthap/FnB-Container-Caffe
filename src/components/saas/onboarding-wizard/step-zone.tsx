import React from 'react';

const ZONES = ['A', 'B', 'C', 'D'];

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}

export default function StepZoneSelection({ value, onChange, onNext }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {ZONES.map((z) => (
          <button
            key={z}
            onClick={() => onChange(z)}
            className={`rounded-xl border p-6 text-center text-2xl font-display font-bold transition ${
              value === z ? 'border-blue-500 bg-blue-500/20' : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            Zone {z}
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
