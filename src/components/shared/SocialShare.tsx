import { cn } from '@/lib/cn';

interface SocialShareProps {
  url?: string;
  title?: string;
  className?: string;
}

const SOCIAL_LINKS = [
  {
    name: 'Facebook',
    href: 'https://facebook.com/auraspaces',
    icon: 'FB',
    color: 'hover:bg-blue-600',
  },
  {
    name: 'Instagram',
    href: 'https://instagram.com/auraspaces',
    icon: 'IG',
    color: 'hover:bg-pink-600',
  },
  {
    name: 'Zalo',
    href: 'https://zalo.me/0946013633',
    icon: 'ZL',
    color: 'hover:bg-blue-500',
  },
];

export function SocialShare({ className }: SocialShareProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="text-sm font-medium text-muted">Theo dõi chúng tôi</span>
      <div className="flex gap-2">
        {SOCIAL_LINKS.map((social) => (
          <a
            key={social.name}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full',
              'border border-border bg-background text-xs font-bold text-muted',
              'transition-all duration-200',
              'hover:text-white hover:shadow-md',
              social.color,
            )}
            aria-label={social.name}
          >
            {social.icon}
          </a>
        ))}
      </div>
    </div>
  );
}
