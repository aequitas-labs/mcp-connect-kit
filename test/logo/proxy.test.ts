import { describe, expect, it, vi } from 'vitest';

import {
  createLogoProxy,
  FALLBACK_CACHE_CONTROL,
  identifyClient,
  logoPath,
} from '../../src/index.js';
import { answering, publicResolver } from '../support/fake-fetch.js';
import { pngHeader, SVG_LOGO } from '../support/images.js';

const CHATGPT_LOGO = 'https://persistent.oaistatic.com/sonic/misc/openai-logo.png';
const image = (bytes: Uint8Array<ArrayBuffer>, type = 'image/png'): Response =>
  new Response(bytes, { status: 200, headers: { 'content-type': type } });

async function requestFor(logoUri: string): Promise<Request> {
  return new Request(`https://runhome.example${await logoPath(logoUri)}`);
}

describe('createLogoProxy', () => {
  it("kit-fetch:ach-logo-headers — serves a trusted client's logo from your domain, safely and cached for a day", async () => {
    const fetchMock = answering(() => image(pngHeader(256, 256, 2048)));
    const route = createLogoProxy({
      resolveHost: publicResolver,
      fetch: fetchMock,
      edgeCache: null,
    });
    const response = await route(await requestFor(CHATGPT_LOGO));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-security-policy')).toBe("default-src 'none'");
    expect(response.headers.get('cache-control')).toBe(
      'public, s-maxage=86400, stale-while-revalidate=86400',
    );
    expect((await response.arrayBuffer()).byteLength).toBe(2048);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(CHATGPT_LOGO);
  });

  it('kit-fetch:ach-logo-type — refuses anything but PNG, JPEG or WebP bytes, including SVG served as image/png', async () => {
    for (const body of [SVG_LOGO, new TextEncoder().encode('<html>not an image</html>')]) {
      const route = createLogoProxy({
        resolveHost: publicResolver,
        fetch: answering(() => image(body as Uint8Array<ArrayBuffer>, 'image/png')),
        edgeCache: null,
      });
      const response = await route(await requestFor(CHATGPT_LOGO));
      expect(response.headers.get('content-type')).toBe('image/svg+xml');
      expect(response.headers.get('x-mcp-connect-kit-logo')).toBe('fallback; reason=not-an-image');
      expect(await response.text()).not.toContain('<script');
    }
  });

  it("kit-fetch:ach-logo-host — won't fetch a logo from a host the client's entry doesn't list", async () => {
    const fetchMock = answering(() => image(pngHeader(64, 64)));
    const route = createLogoProxy({
      resolveHost: publicResolver,
      fetch: fetchMock,
      edgeCache: null,
    });
    const response = await route(await requestFor('https://tracker.example/pixel.png'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get('x-mcp-connect-kit-logo')).toBe(
      'fallback; reason=host-not-allowed',
    );
    // The screens fall back to the bundled mark, because identifyClient never hands out that URL.
    const identity = identifyClient({
      clientId: 'https://chatgpt.com/oauth/client.json',
      redirectUri: 'https://chatgpt.com/connector_platform_oauth_redirect',
      metadata: { client_name: 'ChatGPT', logo_uri: 'https://tracker.example/pixel.png' },
    });
    expect(identity).toMatchObject({ logo: 'mark', logoUri: null });
  });

  it('kit-fetch:pres-no-error-cache — a failed fetch gets the neutral icon, cached for at most 10 minutes', async () => {
    const failing = vi.fn(async (): Promise<Response> => {
      throw new TypeError('network down');
    });
    const route = createLogoProxy({ resolveHost: publicResolver, fetch: failing, edgeCache: null });
    const response = await route(await requestFor(CHATGPT_LOGO));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml');
    expect(response.headers.get('cache-control')).toBe(FALLBACK_CACHE_CONTROL);
    const maxAge = Number(/s-maxage=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1]);
    expect(maxAge).toBeLessThanOrEqual(600);
  });

  it('kit-fetch:ach-size — refuses a logo over 256 KB, and one over 1024 pixels on a side', async () => {
    const big = createLogoProxy({
      resolveHost: publicResolver,
      fetch: answering(() => image(pngHeader(64, 64, 256 * 1024 + 1))),
      edgeCache: null,
    });
    expect((await big(await requestFor(CHATGPT_LOGO))).headers.get('x-mcp-connect-kit-logo')).toBe(
      'fallback; reason=too-large',
    );
    const wide = createLogoProxy({
      resolveHost: publicResolver,
      fetch: answering(() => image(pngHeader(1025, 10))),
      edgeCache: null,
    });
    expect((await wide(await requestFor(CHATGPT_LOGO))).headers.get('x-mcp-connect-kit-logo')).toBe(
      'fallback; reason=too-many-pixels',
    );
  });

  it("answers 404 when the path's hash doesn't match the logo URI", async () => {
    const route = createLogoProxy({
      fetch: answering(() => image(pngHeader(64, 64))),
      edgeCache: null,
    });
    const response = await route(
      new Request(
        `https://runhome.example/oauth/client-logo/${'0'.repeat(32)}?src=${encodeURIComponent(CHATGPT_LOGO)}`,
      ),
    );
    expect(response.status).toBe(404);
  });

  it('uses the edge cache when one is there, so a second request fetches nothing', async () => {
    const store = new Map<string, Response>();
    const edgeCache = {
      match: async (request: Request): Promise<Response | undefined> =>
        store.get(request.url)?.clone(),
      put: async (request: Request, response: Response): Promise<void> =>
        void store.set(request.url, response),
    } as unknown as Cache;
    const fetchMock = answering(() => image(pngHeader(64, 64)));
    const route = createLogoProxy({ resolveHost: publicResolver, fetch: fetchMock, edgeCache });
    await route(await requestFor(CHATGPT_LOGO));
    const second = await route(await requestFor(CHATGPT_LOGO));
    expect(second.headers.get('content-type')).toBe('image/png');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
