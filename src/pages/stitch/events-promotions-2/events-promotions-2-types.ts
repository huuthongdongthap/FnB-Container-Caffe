/* ── Event Data Types ───────────────────────────────────────────────────── */

export interface EventItem {
  readonly id: number;
  readonly date: string;
  readonly title: string;
  readonly description: string;
  readonly time: string;
  readonly timeIcon: string;
  readonly tag: string;
  readonly image: string;
  readonly alt: string;
}

export interface ArchiveItem {
  readonly title: string;
  readonly month: string;
  readonly image: string;
}
