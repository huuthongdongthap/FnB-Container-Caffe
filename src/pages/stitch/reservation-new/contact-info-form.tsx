import { UserCheck } from 'lucide-react';

interface ContactInfoFormProps {
  fullName: string;
  onFullNameChange: (value: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  note: string;
  onNoteChange: (value: string) => void;
}

export function ContactInfoForm({
  fullName,
  onFullNameChange,
  phone,
  onPhoneChange,
  note,
  onNoteChange,
}: ContactInfoFormProps) {
  return (
    <section className="max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <UserCheck className="w-4 h-4 text-[#4A7C59]" />
        <label className="font-body text-xs font-bold uppercase tracking-widest text-[var(--aura-chrome-mid)]">
          5. THÔNG TIN NGƯỜI ĐẶT BÀN
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        <div>
          <label
            className="font-body text-xs font-bold tracking-wider text-[var(--aura-chrome-mid)] block mb-1.5"
            htmlFor="fullname"
          >
            HỌ VÀ TÊN *
          </label>
          <input
            id="fullname"
            required
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-[var(--aura-chrome-mid)]/50 focus:border-[var(--aura-chrome-bright)] focus:outline-none transition-all"
            placeholder="Ví dụ: Nguyễn Văn An"
            type="text"
          />
        </div>

        <div>
          <label
            className="font-body text-xs font-bold tracking-wider text-[var(--aura-chrome-mid)] block mb-1.5"
            htmlFor="phone"
          >
            SỐ ĐIỆN THOẠI *
          </label>
          <input
            id="phone"
            required
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder-[var(--aura-chrome-mid)]/50 focus:border-[var(--aura-chrome-bright)] focus:outline-none transition-all"
            placeholder="Ví dụ: 0946 013 633"
            type="tel"
          />
        </div>
      </div>

      <div>
        <label
          className="font-body text-xs font-bold tracking-wider text-[var(--aura-chrome-mid)] block mb-1.5"
          htmlFor="note"
        >
          YÊU CẦU ĐẶC BIỆT (TÙY CHỌN)
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-[var(--aura-chrome-mid)]/50 focus:border-[var(--aura-chrome-bright)] focus:outline-none transition-all resize-none h-20"
          placeholder="Ví dụ: Cần bàn gần ổ cắm điện làm việc, mang bánh kem sinh nhật, góc view đẹp chụp ảnh..."
        />
      </div>
    </section>
  );
}

