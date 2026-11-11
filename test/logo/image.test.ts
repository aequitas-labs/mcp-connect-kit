import { describe, expect, it } from 'vitest';

import { sniffImage } from '../../src/index.js';
import {
  jpegHeader,
  pngHeader,
  SVG_LOGO,
  webpExtendedHeader,
  webpLosslessHeader,
  webpLossyHeader,
} from '../support/images.js';

describe('sniffImage', () => {
  it('reads the type and size of PNG, JPEG and all three WebP forms', () => {
    expect(sniffImage(pngHeader(512, 256))).toEqual({
      contentType: 'image/png',
      width: 512,
      height: 256,
    });
    expect(sniffImage(jpegHeader(640, 480))).toEqual({
      contentType: 'image/jpeg',
      width: 640,
      height: 480,
    });
    expect(sniffImage(webpLossyHeader(300, 200))).toEqual({
      contentType: 'image/webp',
      width: 300,
      height: 200,
    });
    expect(sniffImage(webpLosslessHeader(128, 64))).toEqual({
      contentType: 'image/webp',
      width: 128,
      height: 64,
    });
    expect(sniffImage(webpExtendedHeader(1024, 1000))).toEqual({
      contentType: 'image/webp',
      width: 1024,
      height: 1000,
    });
  });

  it('refuses SVG, GIF, HTML and empty input', () => {
    expect(sniffImage(SVG_LOGO)).toBeNull();
    expect(sniffImage(new TextEncoder().encode('GIF89a\x01\x00\x01\x00'))).toBeNull();
    expect(sniffImage(new TextEncoder().encode('<!doctype html>'))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
    expect(sniffImage(pngHeader(0, 10))).toBeNull();
  });
});
