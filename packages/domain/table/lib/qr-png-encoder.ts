import QRCode from 'qrcode';

export interface QrPngOptions {
  width?: number;
  margin?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  const MOD = 65521;
  for (let i = 0; i < bytes.length; i += 1) {
    a = (a + bytes[i]) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}

function writeUint32BE(target: Uint8Array, offset: number, value: number): void {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  writeUint32BE(chunk, 0, data.length);
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(data, 8);
  const crc = crc32(chunk.subarray(4, 8 + data.length));
  writeUint32BE(chunk, 8 + data.length, crc);
  return chunk;
}

/**
 * Wrap raw scanlines in a valid zlib stream using uncompressed DEFLATE stored blocks.
 * Works in Cloudflare Workers and Node.js without native/Node zlib or pngjs dependencies.
 */
function encodeZlibUncompressed(raw: Uint8Array): Uint8Array {
  const MAX_BLOCK = 65535;
  const numBlocks = Math.max(1, Math.ceil(raw.length / MAX_BLOCK));
  const out = new Uint8Array(2 + raw.length + numBlocks * 5 + 4);
  let pos = 0;

  // zlib header: CMF=0x78 (deflate, 32K window), FLG=0x01 (no dict, fastest)
  out[pos++] = 0x78;
  out[pos++] = 0x01;

  let offset = 0;
  for (let i = 0; i < numBlocks; i += 1) {
    const remaining = raw.length - offset;
    const len = Math.min(MAX_BLOCK, remaining);
    const isFinal = i === numBlocks - 1 ? 1 : 0;
    const nlen = (~len) & 0xffff;

    out[pos++] = isFinal; // BFINAL=isFinal, BTYPE=00 (stored)
    out[pos++] = len & 0xff;
    out[pos++] = (len >>> 8) & 0xff;
    out[pos++] = nlen & 0xff;
    out[pos++] = (nlen >>> 8) & 0xff;
    out.set(raw.subarray(offset, offset + len), pos);
    pos += len;
    offset += len;
  }

  writeUint32BE(out, pos, adler32(raw));
  return out;
}

/**
 * Encode a QR code payload into a PNG Uint8Array using only `QRCode.create`
 * (available in both `qrcode/lib/browser.js` on Cloudflare Workers and `qrcode/lib/index.js` on Node).
 */
export function encodeQrToPngBytes(payload: string, options: QrPngOptions = {}): Uint8Array {
  const margin = Math.max(0, Math.floor(options.margin ?? 2));
  const targetWidth = Math.max(64, Math.floor(options.width ?? 400));
  const errorCorrectionLevel = options.errorCorrectionLevel ?? 'M';

  const qr = QRCode.create(payload, { errorCorrectionLevel });
  const moduleCount = qr.modules.size;
  const totalModules = moduleCount + margin * 2;
  const scale = Math.max(1, Math.floor(targetWidth / totalModules));
  const imageSize = totalModules * scale;

  // 8-bit grayscale PNG: each scanline has 1 filter byte (0 = None) + imageSize pixel bytes
  const stride = imageSize + 1;
  const raw = new Uint8Array(stride * imageSize);
  raw.fill(255); // white background

  for (let y = 0; y < imageSize; y += 1) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter type 0
    const modY = Math.floor(y / scale) - margin;
    if (modY < 0 || modY >= moduleCount) continue;

    for (let modX = 0; modX < moduleCount; modX += 1) {
      if (!qr.modules.get(modY, modX)) continue;
      const pxStart = rowStart + 1 + (modX + margin) * scale;
      for (let dx = 0; dx < scale; dx += 1) {
        raw[pxStart + dx] = 0; // black module
      }
    }
  }

  const ihdr = new Uint8Array(13);
  writeUint32BE(ihdr, 0, imageSize);
  writeUint32BE(ihdr, 4, imageSize);
  ihdr[8] = 8; // bit depth: 8
  ihdr[9] = 0; // color type: 0 (grayscale)
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter: adaptive
  ihdr[12] = 0; // interlace: none

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', encodeZlibUncompressed(raw));
  const iendChunk = makeChunk('IEND', new Uint8Array(0));

  const png = new Uint8Array(
    PNG_SIGNATURE.length + ihdrChunk.length + idatChunk.length + iendChunk.length
  );
  let cursor = 0;
  png.set(PNG_SIGNATURE, cursor);
  cursor += PNG_SIGNATURE.length;
  png.set(ihdrChunk, cursor);
  cursor += ihdrChunk.length;
  png.set(idatChunk, cursor);
  cursor += idatChunk.length;
  png.set(iendChunk, cursor);

  return png;
}
