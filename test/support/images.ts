/** Builds just enough of an image's header for the sniffer to read its type and size. */

export function pngHeader(width: number, height: number, padTo = 64): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(Math.max(padTo, 33));
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

export function jpegHeader(width: number, height: number): Uint8Array<ArrayBuffer> {
  // SOI, an APP0 segment of 16 bytes, then SOF0 with the size.
  const app0 = [
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01,
    0x00, 0x00,
  ];
  const sof0 = [
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    0x03,
  ];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof0, ...new Array(16).fill(0)]);
}

function riff(chunk: string, payload: number[]): Uint8Array<ArrayBuffer> {
  const ascii = (text: string): number[] => [...text].map((char) => char.charCodeAt(0));
  return new Uint8Array([
    ...ascii('RIFF'),
    0,
    0,
    0,
    0,
    ...ascii('WEBP'),
    ...ascii(chunk),
    0,
    0,
    0,
    0,
    ...payload,
    ...new Array(16).fill(0),
  ]);
}

export function webpLossyHeader(width: number, height: number): Uint8Array<ArrayBuffer> {
  // Frame tag (3 bytes), start code (3 bytes), then 14-bit width and height.
  return riff('VP8 ', [
    0,
    0,
    0,
    0x9d,
    0x01,
    0x2a,
    width & 0xff,
    width >> 8,
    height & 0xff,
    height >> 8,
  ]);
}

export function webpLosslessHeader(width: number, height: number): Uint8Array<ArrayBuffer> {
  const bits = (width - 1) | ((height - 1) << 14);
  return riff('VP8L', [
    0x2f,
    bits & 0xff,
    (bits >> 8) & 0xff,
    (bits >> 16) & 0xff,
    (bits >>> 24) & 0xff,
  ]);
}

export function webpExtendedHeader(width: number, height: number): Uint8Array<ArrayBuffer> {
  const w = width - 1;
  const h = height - 1;
  return riff('VP8X', [
    0,
    0,
    0,
    0,
    w & 0xff,
    (w >> 8) & 0xff,
    (w >> 16) & 0xff,
    h & 0xff,
    (h >> 8) & 0xff,
    (h >> 16) & 0xff,
  ]);
}

export const SVG_LOGO: Uint8Array<ArrayBuffer> = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
) as Uint8Array<ArrayBuffer>;
