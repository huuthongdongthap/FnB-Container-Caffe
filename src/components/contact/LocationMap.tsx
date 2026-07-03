import { cn } from '@/lib/cn';
import { Map, MapPin } from 'lucide-react';

interface LocationMapProps {
  className?: string;
}

const ADDRESS = {
  street: '39 Nguyễn Tất Thành',
  ward: 'Phường Sa Đéc',
  city: 'Đồng Tháp, Việt Nam',
};

const MAPS_QUERY = '39+Nguy%E1%BB%85n+T%E1%BA%A5t+Th%C3%A0nh,+Sa+%C4%90%C3%A9c,+%C4%90%E1%BB%93ng+Th%C3%A1p';

export function LocationMap({ className }: LocationMapProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Address card */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-1 text-2xl" aria-hidden="true"><MapPin size={24} className="inline" /></div>
        <h3 className="font-display text-lg font-semibold text-foreground">
          Địa Chỉ
        </h3>
        <address className="mt-2 not-italic text-muted">
          <p>{ADDRESS.street}</p>
          <p>{ADDRESS.ward}</p>
          <p>{ADDRESS.city}</p>
        </address>
        <a
          href={`https://maps.google.com/?q=${MAPS_QUERY}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-warm"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Xem bản đồ &rarr;
        </a>
      </div>

      {/* Static map fallback */}
      <div className="overflow-hidden rounded-2xl border border-border">
        <a
          href={`https://maps.google.com/?q=${MAPS_QUERY}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <div className="flex aspect-[16/9] items-center justify-center bg-card md:aspect-[2/1]">
            <div className="text-center">
              <div className="mb-2 text-4xl" aria-hidden="true"><Map size={36} className="block mx-auto" /></div>
              <p className="text-sm text-muted">
                Bản đồ Google Maps
              </p>
              <p className="text-xs text-muted/60">
                {ADDRESS.street}, {ADDRESS.city}
              </p>
              <span className="mt-3 inline-block rounded-xl bg-accent/10 px-4 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/20">
                Mở trong Google Maps
              </span>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}
