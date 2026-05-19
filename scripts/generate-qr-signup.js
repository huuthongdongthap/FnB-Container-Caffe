#!/usr/bin/env node
/**
 * Generate QR code PNG for standee, leaflet, and receipt printing.
 * Usage: node scripts/generate-qr-signup.js [base-url]
 * Output: public/qr/{standee|leaflet|receipt}.png
 */

import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.argv[2] || 'https://fnb-caffe-container.pages.dev';
const SIGNUP_URL = BASE_URL + '/dang-ky-thanh-vien';
const OUTPUT_DIR = path.resolve('public/qr');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const VARIANTS = [
  {
    name: 'qr-signup-standee.png',
    width: 1200,
    margin: 4,
    errorCorrectionLevel: 'H',
    color: { dark: '#0A1A2E', light: '#FAFAFA' },
    label: 'Standee (1200×1200)',
  },
  {
    name: 'qr-signup-leaflet.png',
    width: 600,
    margin: 3,
    errorCorrectionLevel: 'M',
    color: { dark: '#0A1A2E', light: '#FFFFFF' },
    label: 'Leaflet (600×600)',
  },
  {
    name: 'qr-signup-receipt.png',
    width: 300,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#FFFFFF' },
    label: 'Receipt (300×300)',
  },
];

console.log('Generating QR codes for:', SIGNUP_URL);

for (const v of VARIANTS) {
  const out = path.join(OUTPUT_DIR, v.name);
  await QRCode.toFile(out, SIGNUP_URL, {
    errorCorrectionLevel: v.errorCorrectionLevel,
    type: 'png',
    width: v.width,
    margin: v.margin,
    color: v.color,
  });
  console.log('  ✅', v.label, '→', out);
}

console.log('\nDone. Files in', OUTPUT_DIR);
