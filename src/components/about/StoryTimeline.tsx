import { cn } from '@/lib/cn';

interface Milestone {
  year: string;
  title: string;
  description: string;
}

interface StoryTimelineProps {
  milestones: Milestone[];
  className?: string;
}

export function StoryTimeline({ milestones, className }: StoryTimelineProps) {
  return (
    <section className={cn('py-16', className)}>
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-12 text-center">
          <span className="font-utility text-xs font-semibold uppercase tracking-[4px] text-accent">
            Hành Trình
          </span>
          <h2 className="mt-2 font-display text-3xl font-bold text-foreground md:text-4xl">
            Lịch Sử Hình Thành
          </h2>
          <p className="mt-2 text-muted">
            Câu chuyện của chúng tôi bắt đầu từ một ý tưởng đơn giản
          </p>
        </div>

        <ol className="relative space-y-12" role="list">
          {milestones.map((milestone, index) => (
            <li key={milestone.year} role="listitem">
              <div className="group relative pl-8 md:pl-12">
                {/* Timeline line */}
                {index < milestones.length - 1 && (
                  <div className="absolute left-[11px] top-6 h-full w-px bg-border md:left-[15px]" />
                )}

                {/* Timeline dot */}
                <div className="absolute left-0 top-1.5 h-[10px] w-[10px] rounded-full border-2 border-accent bg-background md:h-[14px] md:w-[14px]" />

                {/* Year badge */}
                <div className="mb-2 inline-block rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-xs font-semibold text-accent">
                  {milestone.year}
                </div>

                {/* Content */}
                <h3 className="font-display text-xl font-semibold text-foreground">
                  {milestone.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted md:text-base">
                  {milestone.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
