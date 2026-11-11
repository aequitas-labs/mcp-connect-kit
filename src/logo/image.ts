/** A raster image the kit will serve, recognised by its bytes. */
export interface SniffedImage {
  readonly contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  readonly width: number;
  readonly height: number;
}

const PNG_SIGNATURE: readonly number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function uint16BE(bytes: Uint8Array, at: number): number {
  return ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0);
}

function uint32BE(bytes: Uint8Array, at: number): number {
  return uint16BE(bytes, at) * 0x10000 + uint16BE(bytes, at + 2);
}

function uint24LE(bytes: Uint8Array, at: number): number {
  return (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8) | ((bytes[at + 2] ?? 0) << 16);
}

function sniffPng(bytes: Uint8Array): SniffedImage | null {
  if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) return null;
  if (ascii(bytes, 12, 4) !== 'IHDR') return null;
  return { contentType: 'image/png', width: uint32BE(bytes, 16), height: uint32BE(bytes, 20) };
}

/** Walks JPEG markers to the first start-of-frame, which holds the size. */
function sniffJpeg(bytes: Uint8Array): SniffedImage | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1] ?? 0;
    // Fill bytes and markers with no length.
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      at += 2;
      continue;
    }
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isStartOfFrame) {
      return {
        contentType: 'image/jpeg',
        height: uint16BE(bytes, at + 5),
        width: uint16BE(bytes, at + 7),
      };
    }
    at += 2 + uint16BE(bytes, at + 2);
  }
  return null;
}

function sniffWebp(bytes: Uint8Array): SniffedImage | null {
  if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === 'VP8 ') {
    return {
      contentType: 'image/webp',
      width: (((bytes[27] ?? 0) << 8) | (bytes[26] ?? 0)) & 0x3fff,
      height: (((bytes[29] ?? 0) << 8) | (bytes[28] ?? 0)) & 0x3fff,
    };
  }
  if (chunk === 'VP8L') {
    const bits = uint24LE(bytes, 21) + (bytes[24] ?? 0) * 0x1000000;
    return {
      contentType: 'image/webp',
      width: (bits & 0x3fff) + 1,
      height: (Math.floor(bits / 0x4000) & 0x3fff) + 1,
    };
  }
  if (chunk === 'VP8X') {
    return {
      contentType: 'image/webp',
      width: uint24LE(bytes, 24) + 1,
      height: uint24LE(bytes, 27) + 1,
    };
  }
  return null;
}

/**
 * Recognises a PNG, JPEG or WebP image from its first bytes, whatever the
 * server said its type was, and reads its size. Returns `null` for anything
 * else, including SVG, which can carry script.
 */
export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  const image = sniffPng(bytes) ?? sniffJpeg(bytes) ?? sniffWebp(bytes);
  return image && image.width > 0 && image.height > 0 ? image : null;
}
