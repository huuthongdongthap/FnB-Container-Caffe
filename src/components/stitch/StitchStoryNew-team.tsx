/**
 * StitchStoryNew-team — Team section.
 *
 * Displays a responsive grid of team member cards with grayscale images
 * that transition to full color on hover. Includes a heading with
 * a decorative divider line.
 */

'use client';

import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import type { TeamMember } from './StitchStoryNew-types';

/* ─── Role Defaults ─────────────────────────────────────────────────── */

const roleDefaults: Record<string, string> = {
  'storyNew.teamRole1': 'Principal Architect',
  'storyNew.teamRole2': 'Extraction Engineer',
  'storyNew.teamRole3': 'Head of Roast',
  'storyNew.teamRole4': 'Operations Lead',
};

/* ─── Team Section ──────────────────────────────────────────────────── */

interface TeamSectionProps {
  members: TeamMember[];
}

export function TeamSection({ members }: TeamSectionProps) {
  const { t } = useTranslation();

  const teamTitleText = t('storyNew.teamTitle', {
    defaultValue: 'The Minds Behind\nthe Machine',
  });

  return (
    <section className="py-32 px-[64px] bg-[var(--aura-surface-dim)]">
      <div className="max-w-[1280px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end mb-24 gap-8">
          <div>
            <h2
              className="text-[var(--aura-noir-void)] mb-4"
              style={{ fontFamily: "'Libre Caslon Text', serif", fontSize: '45px' }}
            >
              {teamTitleText.split('\n').map((line, i) => (
                <Fragment key={i}>
                  {i > 0 && <br />}
                  {line}
                </Fragment>
              ))}
            </h2>
            <p className="text-[var(--aura-chrome-soft)] max-w-md" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {t('storyNew.teamDesc', {
                defaultValue:
                  'Our team consists of industrial designers, chemical engineers, and master roasters united by a singular focus.',
              })}
            </p>
          </div>
          <div className="h-px w-full md:w-64 bg-[color-mix(in srgb, var(--aura-chrome-dim), transparent 80%)] hidden md:block" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-[24px]">
          {members.map((member) => (
            <div key={member.name} className="group" role="article" data-reveal>
              <div
                className="relative mb-6 aspect-[4/5] overflow-hidden"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid color-mix(in srgb, var(--aura-chrome-dim), transparent 80%)',
                }}
              >
                <img
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
                  src={member.imageUrl}
                  alt={member.imageAlt}
                  loading="lazy"
                />
              </div>
              <h4 className="text-white text-lg font-bold tracking-tight mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {member.name}
              </h4>
              <p
                className="text-[var(--aura-chrome-bright)] text-xs uppercase tracking-widest font-bold"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {t(member.role, { defaultValue: roleDefaults[member.role] })}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
