import { useState, type FormEvent } from 'react';
import { cn } from '@/lib/cn';
import { useContactStore } from '@/hooks/stores/use-contact-store';
import { CheckCircle } from 'lucide-react';

interface ContactFormProps {
  className?: string;
}

interface FormErrors {
  name?: string;
  phone?: string;
  content?: string;
}

const PHONE_REGEX = /^0\d{8,10}$/;

function validateName(value: string): string | undefined {
  if (!value.trim()) return 'Vui lòng nhập tên của bạn.';
  if (value.trim().length < 2) return 'Tên phải có ít nhất 2 ký tự.';
  return undefined;
}

function validatePhone(value: string): string | undefined {
  if (!value.trim()) return 'Vui lòng nhập số điện thoại.';
  if (!PHONE_REGEX.test(value.replace(/\s/g, ''))) return 'Số điện thoại không hợp lệ (VD: 0946013633).';
  return undefined;
}

function validateContent(value: string): string | undefined {
  if (!value.trim()) return 'Vui lòng nhập nội dung.';
  if (value.trim().length < 5) return 'Nội dung phải có ít nhất 5 ký tự.';
  return undefined;
}

export function ContactForm({ className }: ContactFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const { submitContact, loading: isSubmitting, submitted: isSuccess, error } = useContactStore();

  const validate = (): FormErrors => {
    return {
      name: validateName(name),
      phone: validatePhone(phone),
      content: validateContent(content),
    };
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors(validate());
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const newErrors = validate();
    setErrors(newErrors);
    setTouched({ name: true, phone: true, content: true });

    if (newErrors.name || newErrors.phone || newErrors.content) return;

    try {
      await submitContact(name.trim(), phone.trim(), content.trim());
      setName('');
      setPhone('');
      setContent('');
      setErrors({});
      setTouched({});
    } catch {
      // Error is handled by the hook
    }
  };

  if (isSuccess) {
    return (
      <div className={cn('rounded-2xl border border-accent/20 bg-accent/5 p-8 text-center', className)}>
        <div className="mb-3 text-4xl"><CheckCircle size={36} className="block mx-auto text-green-500" /></div>
        <h3 className="font-display text-xl font-semibold text-foreground">Cảm ơn bạn!</h3>
        <p className="mt-2 text-muted">
          Tin nhắn của bạn đã được gửi. Chúng tôi sẽ phản hồi trong vòng 24h.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={cn('space-y-5', className)}
    >
      <div>
        <label
          htmlFor="contact-name"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Họ Và Tên <span className="text-destructive">*</span>
        </label>
        <input
          id="contact-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => handleBlur('name')}
          placeholder="Nguyễn Văn A"
          className={cn(
            'w-full rounded-xl border bg-background px-4 py-3 text-sm text-foreground',
            'placeholder:text-muted/50 transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-accent/40',
            errors.name && touched.name
              ? 'border-destructive'
              : 'border-border',
          )}
          aria-invalid={!!errors.name && touched.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
        />
        {errors.name && touched.name && (
          <p id="name-error" className="mt-1 text-xs text-destructive">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="contact-phone"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Số Điện Thoại <span className="text-destructive">*</span>
        </label>
        <input
          id="contact-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => handleBlur('phone')}
          placeholder="0946 013 633"
          className={cn(
            'w-full rounded-xl border bg-background px-4 py-3 text-sm text-foreground',
            'placeholder:text-muted/50 transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-accent/40',
            errors.phone && touched.phone
              ? 'border-destructive'
              : 'border-border',
          )}
          aria-invalid={!!errors.phone && touched.phone}
          aria-describedby={errors.phone ? 'phone-error' : undefined}
        />
        {errors.phone && touched.phone && (
          <p id="phone-error" className="mt-1 text-xs text-destructive">
            {errors.phone}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="contact-content"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Nội Dung <span className="text-destructive">*</span>
        </label>
        <textarea
          id="contact-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={() => handleBlur('content')}
          placeholder="Nhập nội dung góp ý..."
          rows={5}
          className={cn(
            'w-full rounded-xl border bg-background px-4 py-3 text-sm text-foreground',
            'placeholder:text-muted/50 transition-colors duration-200 resize-y',
            'focus:outline-none focus:ring-2 focus:ring-accent/40',
            errors.content && touched.content
              ? 'border-destructive'
              : 'border-border',
          )}
          aria-invalid={!!errors.content && touched.content}
          aria-describedby={errors.content ? 'content-error' : undefined}
        />
        {errors.content && touched.content && (
          <p id="content-error" className="mt-1 text-xs text-destructive">
            {errors.content}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          Có lỗi xảy ra{error ? `: ${error}` : ''}
        </div>
      )}

      <div className="text-xs text-muted">
        Chúng tôi phản hồi trong vòng 24h
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          'w-full rounded-xl px-6 py-3 font-semibold text-white transition-all duration-200',
          'bg-primary hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-accent/40',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        {isSubmitting ? 'Đang gửi...' : 'Gửi Tin Nhắn'}
      </button>
    </form>
  );
}
