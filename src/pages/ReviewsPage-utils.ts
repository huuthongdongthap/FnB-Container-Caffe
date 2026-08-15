import type { ReviewRecord } from '@/hooks/use-reviews';
import type { ReviewEntry } from '@/components/stitch';

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function reviewRecordToEntry(record: ReviewRecord): ReviewEntry {
  const name = record.customer_name || 'Guest';
  return {
    id: record.id,
    author: name,
    avatarUrl: '',
    avatarAlt: '',
    rating: record.rating,
    content: record.comment || '',
    liked: false,
    likeCount: 0,
    date: formatDate(record.created_at),
  };
}
