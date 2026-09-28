/**
 * StitchStoryNew — Default data constants.
 *
 * Hero background URL, architectural detail image, timeline phase images,
 * default team members, and timeline phases configuration.
 */

import type { TeamMember } from './StitchStoryNew-types';

/* ─── Default Hero Background ──────────────────────────────────────── */

export const defaultHeroBgUrl =
  '/photos/IMG_6699.webp';

export const defaultArchImageUrl =
  '/photos/IMG_6696.webp';

export const defaultTimelineImages = [
  '/photos/IMG_6698.webp',
  '/photos/IMG_6703.webp',
  '/photos/IMG_6631.webp',
] as const;

/* ─── Default Team Members ──────────────────────────────────────────── */

export const defaultTeamMembers: TeamMember[] = [
  {
    name: 'Nguyễn Hữu Còn',
    role: 'storyNew.teamRole1',
    imageUrl:
      '/photos/IMG_6593.webp',
    imageAlt:
      'Chân dung Người sáng lập AURA CAFE Sa Đéc.',
  },
  {
    name: 'Nguyễn Văn Minh',
    role: 'storyNew.teamRole2',
    imageUrl:
      '/photos/IMG_6581.webp',
    imageAlt:
      'Chân dung Quản lý vận hành AURA CAFE.',
  },
  {
    name: 'Lê Hoàng Đức',
    role: 'storyNew.teamRole3',
    imageUrl:
      '/photos/IMG_6554-frame.webp',
    imageAlt:
      'Chân dung Trưởng nhóm pha chế AURA CAFE.',
  },
  {
    name: 'Trần Thị Lan',
    role: 'storyNew.teamRole4',
    imageUrl:
      '/photos/IMG_6555-frame.webp',
    imageAlt:
      'Chân dung Chăm sóc khách hàng AURA CAFE.',
  },
];

/* ─── Timeline Phases ──────────────────────────────────────────────── */

export const timelinePhases = [
  {
    phase: 'PHASE 01',
    year: '2022',
    title: 'storyNew.phase01Title',
    description: 'storyNew.phase01Desc',
    imageUrl: defaultTimelineImages[0],
    imageAlt:
      'Technical architectural drawings and blue-prints of a shipping container cafe layout spread across a dark metal desk. Fine-lined chrome pens and a matte black coffee cup sit on the plans. Dramatic low-key lighting with a subtle blue tint, reflecting an industrial design office.',
  },
  {
    phase: 'PHASE 02',
    year: '2023',
    title: 'storyNew.phase02Title',
    description: 'storyNew.phase02Desc',
    imageUrl: defaultTimelineImages[1],
    imageAlt:
      'Macro photo of a welding spark flying from a steel container frame. Dark industrial workshop setting with deep shadows and brilliant, sharp points of light. The metal is being joined to form the structure of a modern cafe. Cool blue and warm orange color palette.',
  },
  {
    phase: 'PHASE 03',
    year: '2024',
    title: 'storyNew.phase03Title',
    description: 'storyNew.phase03Desc',
    imageUrl: defaultTimelineImages[2],
    imageAlt:
      'The finished Aura Cafe at night, a glowing glass and steel structure standing boldly against a dark urban background. The interior light is a warm bronze, casting a long inviting glow on the sidewalk. Reflections of city lights shimmer on the polished chrome surfaces.',
    isActive: true,
  },
];

/* ─── Value Cards ──────────────────────────────────────────────────── */

export const valueCards = [
  {
    iconKey: 'Verified' as const,
    title: 'storyNew.value1Title',
    description: 'storyNew.value1Desc',
  },
  {
    iconKey: 'Settings' as const,
    title: 'storyNew.value2Title',
    description: 'storyNew.value2Desc',
  },
  {
    iconKey: 'Leaf' as const,
    title: 'storyNew.value3Title',
    description: 'storyNew.value3Desc',
  },
];
