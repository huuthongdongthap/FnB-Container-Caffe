import React from 'react';
import { cn } from '@/lib/cn';

interface TeamMember {
  name: string;
  role: string;
  bio: string;
  avatar: React.ElementType;
}

interface TeamSectionProps {
  members: TeamMember[];
  className?: string;
}

export function TeamSection({ members, className }: TeamSectionProps) {
  return (
    <section className={cn('py-16', className)}>
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-12 text-center">
          <span className="font-utility text-xs font-semibold uppercase tracking-[4px] text-accent">
            Đội Ngũ
          </span>
          <h2 className="mt-2 font-display text-3xl font-bold text-foreground md:text-4xl">
            Gặp Gỡ Chúng Tôi
          </h2>
          <p className="mt-2 text-muted">
            Những con người tạo nên linh hồn của AURA CAFE
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <div
              key={member.name}
              className="group rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:border-accent/30 hover:shadow-lg"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-2xl">
                {React.createElement(member.avatar, { size: 24, className: 'text-accent' })}
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground">
                {member.name}
              </h3>
              <p className="mt-1 text-sm font-medium text-accent">
                {member.role}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {member.bio}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
