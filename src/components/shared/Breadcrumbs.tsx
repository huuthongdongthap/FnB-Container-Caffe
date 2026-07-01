import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

interface BreadcrumbItem {
  label: string;
  to: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: item.to ? `${window.location.origin}${item.to}` : undefined,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav
        aria-label="Breadcrumb"
        className={cn('flex items-center gap-2 text-sm text-muted', className)}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <span key={item.to} className="flex items-center gap-2">
              {index > 0 && (
                <span className="text-muted/50" aria-hidden="true">/</span>
              )}
              {isLast ? (
                <span
                  aria-current="page"
                  className="font-medium text-foreground"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.to}
                  className="text-muted transition-colors hover:text-accent-warm"
                >
                  {item.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
    </>
  );
}
