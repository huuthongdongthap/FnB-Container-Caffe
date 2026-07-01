import { clsx, type ClassValue } from 'clsx';

/**
 * Merges Tailwind CSS classes, resolving conflicts.
 * clsx handles conditional/array/object class merging.
 * For full Tailwind conflict resolution, add tailwind-merge later (YAGNI for now).
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
