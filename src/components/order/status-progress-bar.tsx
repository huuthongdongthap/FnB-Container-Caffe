interface StatusProgressBarProps {
  currentStep: number;
  steps: Array<{ key: string; label: string }>;
  className?: string;
}

export function StatusProgressBar({ currentStep, steps, className }: StatusProgressBarProps) {
  return (
    <div className={className ?? 'mb-8'}>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-chrome-light/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-chrome-dark via-chrome-light to-chrome-bright transition-all duration-700"
          style={{
            width: `${Math.max(0, ((currentStep + 1) / steps.length) * 100)}%`,
          }}
        />
      </div>
      <div className="flex justify-between">
        {steps.map((step, idx) => (
          <div
            key={step.key}
            className={`flex flex-col items-center ${
              idx <= currentStep ? 'text-chrome-light' : 'text-chrome-light/20'
            }`}
          >
            <div
              className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                idx < currentStep
                  ? 'bg-chrome-light text-[#0A1A2E]'
                  : idx === currentStep
                    ? 'border-2 border-chrome-light text-chrome-light'
                    : 'border-2 border-chrome-light/20 text-chrome-light/20'
              }`}
            >
              {idx < currentStep ? '✓' : idx + 1}
            </div>
            <span className="text-[10px]">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
