interface NextStepsProps {
  className?: string;
}

const STEPS = [
  'Chúng tôi sẽ gọi/xác nhận đơn qua Zalo hoặc điện thoại trong 5 phút.',
  'Chuẩn bị và đóng gói đồ uống',
  'Giao hàng trong 15-20 phút (hoặc sẵn sàng tại quán)',
];

export function NextSteps({ className }: NextStepsProps) {
  return (
    <div className={className ?? 'mb-8 rounded-xl border border-chrome-light/10 bg-[#0A1A2E]/50 p-6 text-left'}>
      <h3 className="mb-4 font-display text-lg font-semibold text-chrome-bright">
        Các bước tiếp theo
      </h3>
      <div className="space-y-3">
        {STEPS.map((text, idx) => (
          <div key={idx} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-chrome-light/10 text-xs font-bold text-chrome-light">
              {idx + 1}
            </span>
            <p className="text-sm text-chrome-light/70">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
