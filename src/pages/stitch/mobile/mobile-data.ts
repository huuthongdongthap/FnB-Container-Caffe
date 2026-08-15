import type { MenuItem, NavItem } from './mobile-types';

// ─── Placeholder image generators (inline SVG data URIs) ───────────────────
// Replace with real assets in public/ later.

export const HERO_IMG =
  'data:image/svg+xml;base64,' +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 574">
    <defs>
      <radialGradient id="g1" cx="70%" cy="30%" r="60%"><stop offset="0%" stop-color="#1a1a3e"/><stop offset="100%" stop-color="#050510"/></radialGradient>
      <radialGradient id="g2" cx="30%" cy="70%" r="40%"><stop offset="0%" stop-color="#3a5f8a" stop-opacity="0.4"/><stop offset="100%" stop-color="transparent"/></radialGradient>
    </defs>
    <rect width="390" height="574" fill="url(#g1)"/>
    <rect width="390" height="574" fill="url(#g2)"/>
    <path d="M160 160 Q155 130 165 100" stroke="rgba(255,255,255,0.12)" fill="none" stroke-width="1.5"/>
    <path d="M175 155 Q170 120 180 90" stroke="rgba(255,255,255,0.08)" fill="none" stroke-width="1.2"/>
    <ellipse cx="170" cy="320" rx="80" ry="20" fill="rgba(255,255,255,0.04)"/>
    <rect x="90" y="260" width="160" height="80" rx="8" fill="rgba(30,30,50,0.6)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <path d="M155 285 Q155 275 165 278 Q175 275 175 285 Q175 298 165 305 Q155 298 155 285Z" fill="rgba(180,170,155,0.2)"/>
    <circle cx="120" cy="200" r="1.2" fill="rgba(210,210,215,0.35)"/>
    <circle cx="200" cy="180" r="0.8" fill="rgba(210,210,215,0.3)"/>
    <circle cx="250" cy="220" r="1" fill="rgba(210,210,215,0.25)"/>
    <circle cx="140" cy="350" r="0.9" fill="rgba(210,210,215,0.3)"/>
    <circle cx="300" cy="160" r="1.1" fill="rgba(210,210,215,0.2)"/>
    <circle cx="100" cy="420" r="0.7" fill="rgba(210,210,215,0.25)"/>
    <circle cx="320" cy="380" r="1.3" fill="rgba(210,210,215,0.2)"/>
    <circle cx="300" cy="120" r="120" fill="rgba(40,60,120,0.15)"/>
  </svg>`);

export const MOCHA_IMG =
  'data:image/svg+xml;base64,' +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 192">
    <rect width="256" height="192" fill="#131316"/>
    <rect x="20" y="20" width="216" height="152" rx="16" fill="rgba(60,45,30,0.3)" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <path d="M80 60 L80 140 Q80 160 100 160 L140 160 Q160 160 160 140 L160 60Z" fill="rgba(80,55,35,0.4)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <ellipse cx="120" cy="80" rx="30" ry="6" fill="rgba(50,30,15,0.6)"/>
    <ellipse cx="115" cy="90" rx="25" ry="5" fill="rgba(60,35,20,0.5)"/>
    <rect x="100" y="65" width="6" height="2" rx="1" fill="rgba(210,210,215,0.5)" transform="rotate(-20 103 66)"/>
    <rect x="130" y="70" width="5" height="2" rx="1" fill="rgba(210,210,215,0.4)" transform="rotate(15 132 71)"/>
    <rect x="110" y="78" width="4" height="1.5" rx="0.75" fill="rgba(210,210,215,0.35)" transform="rotate(-30 112 79)"/>
    <circle cx="125" cy="72" r="0.8" fill="rgba(220,220,225,0.4)"/>
    <circle cx="200" cx="200" cy="80" r="30" fill="rgba(255,220,150,0.06)"/>
  </svg>`);

export const ESPRESSO_IMG =
  'data:image/svg+xml;base64,' +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 192">
    <rect width="256" height="192" fill="#0e0e12"/>
    <rect x="30" y="20" width="196" height="152" rx="16" fill="rgba(20,20,30,0.8)" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
    <path d="M100 50 L95 140 Q95 150 105 150 L145 150 Q155 150 155 140 L150 50Z" fill="rgba(10,10,15,0.9)" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
    <ellipse cx="125" cy="58" rx="25" ry="5" fill="rgba(180,130,60,0.25)"/>
    <ellipse cx="125" cy="60" rx="20" ry="3" fill="rgba(200,150,70,0.2)"/>
    <ellipse cx="70" cy="120" rx="8" ry="5" fill="rgba(35,20,10,0.6)" transform="rotate(-25 70 120)"/>
    <line x1="67" y1="117" x2="73" y2="123" stroke="rgba(80,50,30,0.4)" stroke-width="0.8"/>
    <ellipse cx="180" cy="130" rx="7" ry="4.5" fill="rgba(35,20,10,0.5)" transform="rotate(30 180 130)"/>
    <line x1="177" y1="128" x2="183" y2="133" stroke="rgba(80,50,30,0.35)" stroke-width="0.8"/>
    <ellipse cx="85" cy="145" rx="6" ry="4" fill="rgba(30,18,8,0.45)" transform="rotate(-10 85 145)"/>
    <circle cx="200" cy="50" r="20" fill="rgba(200,210,220,0.03)"/>
  </svg>`);

export const COLD_BREW_IMG =
  'data:image/svg+xml;base64,' +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 192">
    <rect width="256" height="192" fill="#0c0c14"/>
    <rect x="20" y="20" width="216" height="152" rx="16" fill="rgba(40,42,50,0.3)" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
    <rect x="95" y="40" width="50" height="110" rx="6" fill="rgba(180,140,80,0.08)" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <defs><linearGradient id="amber" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(200,160,80,0.15)"/><stop offset="100%" stop-color="rgba(160,110,40,0.25)"/></linearGradient></defs>
    <rect x="96" y="50" width="48" height="95" rx="4" fill="url(#amber)"/>
    <circle cx="110" cy="70" r="1.5" fill="rgba(255,255,255,0.08)"/>
    <circle cx="125" cy="85" r="1" fill="rgba(255,255,255,0.06)"/>
    <circle cx="115" cy="100" r="1.8" fill="rgba(255,255,255,0.07)"/>
    <circle cx="130" cy="110" r="1.2" fill="rgba(255,255,255,0.05)"/>
    <circle cx="108" cy="120" r="1" fill="rgba(255,255,255,0.06)"/>
    <rect x="93" y="36" width="54" height="6" rx="3" fill="rgba(180,180,190,0.12)" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/>
    <rect x="95" y="90" width="50" height="8" rx="2" fill="rgba(200,210,220,0.06)"/>
    <rect x="108" y="55" width="12" height="12" rx="2" fill="rgba(200,210,220,0.04)" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>
    <line x1="200" y1="60" x2="220" y2="80" stroke="rgba(255,255,255,0.02)" stroke-width="0.5"/>
    <line x1="210" y1="100" x2="230" y2="120" stroke="rgba(255,255,255,0.015)" stroke-width="0.5"/>
  </svg>`);

export const MEMBERSHIP_IMG =
  'data:image/svg+xml;base64,' +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <rect width="200" height="200" rx="16" fill="#0e0e1a"/>
    <circle cx="100" cy="60" r="60" fill="rgba(180,150,100,0.06)"/>
    <circle cx="80" cy="140" r="40" fill="rgba(100,80,60,0.05)"/>
    <ellipse cx="90" cy="140" rx="35" ry="12" fill="rgba(255,255,255,0.02)"/>
    <path d="M60 110 Q60 80 90 70 Q120 80 120 110 L115 145 Q115 150 90 150 Q65 150 65 145Z" fill="rgba(40,40,55,0.4)"/>
    <rect x="82" y="115" width="16" height="20" rx="3" fill="rgba(25,25,35,0.6)" stroke="rgba(255,255,255,0.06)"/>
    <circle cx="90" cy="85" r="16" fill="rgba(50,50,65,0.35)"/>
    <circle cx="50" cy="50" r="4" fill="rgba(200,170,120,0.08)"/>
    <circle cx="150" cy="80" r="6" fill="rgba(200,170,120,0.05)"/>
    <circle cx="130" cy="160" r="8" fill="rgba(180,150,100,0.04)"/>
    <text x="100" y="180" text-anchor="middle" font-family="sans-serif" font-size="9" fill="rgba(200,210,220,0.15)" letter-spacing="2">EXCLUSIVE</text>
  </svg>`);

// ─── Featured menu items ─────────────────────────────────────────────────────

export const FEATURED_ITEMS: MenuItem[] = [
  { id: 'silver-mocha', nameVi: 'Silver Mocha', nameEn: 'Silver Mocha', price: 8.5, image: MOCHA_IMG },
  { id: 'midnight-espresso', nameVi: 'Midnight Espresso', nameEn: 'Midnight Espresso', price: 6.0, image: ESPRESSO_IMG },
  { id: 'aura-cold-brew', nameVi: 'Aura Cold Brew', nameEn: 'Aura Cold Brew', price: 7.25, image: COLD_BREW_IMG },
];

// ─── Bottom navigation items ─────────────────────────────────────────────────

export const BOTTOM_NAV: NavItem[] = [
  { icon: '\u{1F37C}', label: 'Home', labelEn: 'Home', active: true },
  { icon: '☕', label: 'Coffee', labelEn: 'Coffee', active: false },
  { icon: '\u{1F50D}', label: 'Scanner', labelEn: 'Scanner', active: false, center: true },
  { icon: '\u{1F6D2}', label: 'Cart', labelEn: 'Cart', active: false },
  { icon: '\u{1F464}', label: 'Profile', labelEn: 'Profile', active: false },
];
