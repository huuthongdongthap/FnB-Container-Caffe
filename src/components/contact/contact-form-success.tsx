import { cn } from '@/lib/cn';
import { CheckCircle } from 'lucide-react';

interface ContactFormSuccessProps {
  className?: string;
}

export function ContactFormSuccess({ className }: ContactFormSuccessProps) {
  return (
    <div className={cn('rounded-2xl border border-accent/20 bg-accent/5 p-8 text-center', className)}>
      <div className="mb-3 text-4xl">
        <CheckCircle size={36} className="block mx-auto text-green-500" />
      </div>
      <h3 className="font-display text-xl font-semibold text-foreground">
        Cảm ơn bạn!
      </h3>
      <p className="mt-2 text-muted">
        Tin nhắn của bạn đã được gửi. Chúng tôi sẽ phản hồi trong vòng 24h.
      </p>
    </div>
  );
}
