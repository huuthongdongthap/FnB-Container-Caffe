import { useState, type FormEvent } from 'react';
import { cn } from '@/lib/cn';
import { useContactStore } from '@/hooks/stores/use-contact-store';
import type { ContactFormProps, FormErrors } from './contact-form-types';
import { validateName, validatePhone, validateContent } from './contact-form-validators';
import { ContactFormField } from './contact-form-field';
import { ContactFormSuccess } from './contact-form-success';

export function ContactForm({ className }: ContactFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const { submitContact, loading: isSubmitting, submitted: isSuccess, error } = useContactStore();

  const validate = (): FormErrors => ({
    name: validateName(name),
    phone: validatePhone(phone),
    content: validateContent(content),
  });

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
      // Error handled by hook
    }
  };

  if (isSuccess) {
    return <ContactFormSuccess className={className} />;
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={cn('space-y-5', className)}
    >
      <ContactFormField
        id="contact-name"
        label="Họ Và Tên"
        required
        value={name}
        onChange={setName}
        onBlur={() => handleBlur('name')}
        placeholder="Nguyễn Văn A"
        error={errors.name}
        touched={touched.name}
      />

      <ContactFormField
        id="contact-phone"
        label="Số Điện Thoại"
        required
        type="tel"
        value={phone}
        onChange={setPhone}
        onBlur={() => handleBlur('phone')}
        placeholder="0946 013 633"
        error={errors.phone}
        touched={touched.phone}
      />

      <ContactFormField
        id="contact-content"
        label="Nội Dung"
        required
        as="textarea"
        value={content}
        onChange={setContent}
        onBlur={() => handleBlur('content')}
        placeholder="Nhập nội dung góp ý..."
        rows={5}
        error={errors.content}
        touched={touched.content}
      />

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
