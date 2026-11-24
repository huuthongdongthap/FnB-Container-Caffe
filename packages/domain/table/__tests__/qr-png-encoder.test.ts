import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import { inflateSync } from 'node:zlib';
import { encodeQrToPngBytes } from '../lib/qr-png-encoder';

function extractIdatPixels(png: Uint8Array): { width: number; height: number; raw: Buffer } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let offset = 8; // skip PNG signature
  let width = 0;
  let height = 0;
  const idatParts: Uint8Array[] = [];

  while (offset < png.length) {
    const len = view.getUint32(offset, false);
    const type = new TextDecoder('latin1').decode(png.slice(offset + 4, offset + 8));
    const data = png.slice(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      const ihdrView = new DataView(data.buffer, data.byteOffset, data.byteLength);
      width = ihdrView.getUint32(0, false);
      height = ihdrView.getUint32(4, false);
    } else if (type === 'IDAT') {
      idatParts.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + len;
  }

  const combined = Buffer.concat(idatParts);
  const raw = inflateSync(combined);
  return { width, height, raw };
}

describe('encodeQrToPngBytes (Workers-safe PNG QR encoder)', () => {
  it('encodes a URL into valid PNG bytes with PNG signature, IHDR, IDAT, and IEND', () => {
    const bytes = encodeQrToPngBytes('https://aura.example.com/order?t=table-1', {
      width: 256,
      margin: 2,
      errorCorrectionLevel: 'M',
    });

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(100);
    expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

    const ascii = new TextDecoder('latin1').decode(bytes);
    expect(ascii).toContain('IHDR');
    expect(ascii).toContain('IDAT');
    expect(ascii).toContain('IEND');
  });

  it('places modules at (row=modY, col=modX) without transposing the QR matrix', () => {
    const payload = 'https://aura.example.com/order?t=non-symmetric-check-12345';
    const margin = 1;
    const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    // Scale = 1 by requesting width = size + 2 * margin
    const png = encodeQrToPngBytes(payload, {
      width: size + margin * 2,
      margin,
      errorCorrectionLevel: 'M',
    });

    const { width, height, raw } = extractIdatPixels(png);
    expect(width).toBe(size + margin * 2);
    expect(height).toBe(size + margin * 2);

    const stride = width + 1;
    let foundAsymmetric = false;
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const expectedDark = Boolean(qr.modules.get(row, col));
        const px = raw[(row + margin) * stride + 1 + (col + margin)];
        expect(px).toBe(expectedDark ? 0 : 255);
        if (Boolean(qr.modules.get(row, col)) !== Boolean(qr.modules.get(col, row))) {
          foundAsymmetric = true;
        }
      }
    }
    expect(foundAsymmetric).toBe(true);
  });

  it('produces deterministic output for identical payload and options', () => {
    const a = encodeQrToPngBytes('https://aura.example.com/t/ban-1', { width: 200, margin: 1 });
    const b = encodeQrToPngBytes('https://aura.example.com/t/ban-1', { width: 200, margin: 1 });
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
