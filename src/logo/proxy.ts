import { defaultClients } from '../clients/defaults.js';
import { parseUrl } from '../clients/redirects.js';
import type { KnownClient } from '../clients/types.js';
import { FetchRefusedError } from '../fetch/errors.js';
import { guardedFetch } from '../fetch/guarded-fetch.js';
import type { Transport } from '../fetch/guarded-fetch.js';
import { sniffImage } from './image.js';
import { NEUTRAL_ICON_SVG } from './neutral-icon.js';

/** Where the logo route lives unless you choose another path. */
export const DEFAULT_LOGO_BASE_PATH = '/oauth/client-logo';

/** A served logo is kept by the CDN for a day, and served stale for another day while it refreshes. */
export const LOGO_CACHE_CONTROL = 'public, s-maxage=86400, stale-while-revalidate=86400';
/** A failure is kept for at most 10 minutes, so a vendor's fix shows up soon. */
export const FALLBACK_CACHE_CONTROL = 'public, s-maxage=600';

/** Options for `createLogoProxy`. */
export interface LogoProxyOptions extends Transport {
  /** The allowlist. Logos are fetched only from these clients' `logoHosts`. Defaults to `defaultClients`. */
  readonly clients?: readonly KnownClient[] | undefined;
  /** The path the route is mounted at. Defaults to `/oauth/client-logo`. */
  readonly basePath?: string | undefined;
  /** Defaults to 3000 ms. */
  readonly timeoutMs?: number | undefined;
  /** Defaults to 256 KB. */
  readonly maxBytes?: number | undefined;
  /** The largest width or height accepted, in pixels. Defaults to 1024. */
  readonly maxDimension?: number | undefined;
  /**
   * Where to keep responses when the platform's CDN doesn't cache them on
   * its own. Defaults to `caches.default` on Cloudflare Workers, and to none
   * elsewhere. Vercel and most CDNs cache from the `Cache-Control` header.
   */
  readonly edgeCache?: Cache | null | undefined;
}

/** Serves `GET <basePath>/<hash>?src=<logo URI>`. */
export type LogoRoute = (request: Request) => Promise<Response>;

const DEFAULT_MAX_LOGO_BYTES = 256 * 1024;
const DEFAULT_MAX_DIMENSION = 1024;
const DEFAULT_TIMEOUT_MS = 3000;

const SAFE_HEADERS: Readonly<Record<string, string>> = {
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'",
};

async function logoHash(logoUri: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(logoUri));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

/**
 * The same-origin path a screen uses as the `src` of a client's logo. The
 * person's browser loads it from your domain, so the vendor never sees them.
 */
export async function logoPath(
  logoUri: string,
  basePath: string = DEFAULT_LOGO_BASE_PATH,
): Promise<string> {
  return `${basePath}/${await logoHash(logoUri)}?src=${encodeURIComponent(logoUri)}`;
}

function workersDefaultCache(): Cache | null {
  const storage = (globalThis as { caches?: { default?: Cache } }).caches;
  return storage?.default ?? null;
}

function fallback(reason: string): Response {
  return new Response(NEUTRAL_ICON_SVG, {
    status: 200,
    headers: {
      ...SAFE_HEADERS,
      'content-type': 'image/svg+xml',
      'cache-control': FALLBACK_CACHE_CONTROL,
      'x-mcp-connect-kit-logo': `fallback; reason=${reason}`,
    },
  });
}

function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { ...SAFE_HEADERS, 'content-type': 'text/plain', 'cache-control': 'no-store' },
  });
}

/**
 * Makes the logo route. It serves a client's `logo_uri` from your own domain,
 * after checking it hard:
 *
 * - only from a host an allowlisted client lists in `logoHosts`;
 * - over HTTPS, with no cookies and no redirects, from public addresses only;
 * - at most 256 KB and 1024 × 1024 pixels;
 * - PNG, JPEG or WebP by its first bytes, never by its header, so SVG is out.
 *
 * It answers with `nosniff`, `Content-Security-Policy: default-src 'none'`
 * and `Cache-Control: public, s-maxage=86400`, so the CDN keeps the logo and
 * the kit needs no store of its own. When anything fails, it answers with a
 * neutral plug icon that the CDN keeps for at most 10 minutes.
 */
export function createLogoProxy(options: LogoProxyOptions = {}): LogoRoute {
  const clients = options.clients ?? defaultClients;
  const allowedHosts = new Set(clients.flatMap((client) => client.logoHosts ?? []));
  const basePath = (options.basePath ?? DEFAULT_LOGO_BASE_PATH).replace(/\/$/, '');
  const limits = {
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxBytes: options.maxBytes ?? DEFAULT_MAX_LOGO_BYTES,
    accept: 'image/png, image/jpeg, image/webp',
  };
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;

  async function fetchLogo(logoUri: string): Promise<Response> {
    const url = parseUrl(logoUri);
    if (!url || url.protocol !== 'https:' || url.port || !allowedHosts.has(url.hostname)) {
      return fallback('host-not-allowed');
    }
    try {
      const { bytes } = await guardedFetch(logoUri, limits, options);
      const image = sniffImage(bytes);
      if (!image)
        throw new FetchRefusedError('not-an-image', `${logoUri} is not a PNG, JPEG or WebP image`);
      if (image.width > maxDimension || image.height > maxDimension) {
        throw new FetchRefusedError(
          'too-many-pixels',
          `${logoUri} is ${image.width} × ${image.height}`,
        );
      }
      return new Response(bytes, {
        status: 200,
        headers: {
          ...SAFE_HEADERS,
          'content-type': image.contentType,
          'content-length': String(bytes.byteLength),
          'cache-control': LOGO_CACHE_CONTROL,
        },
      });
    } catch (error) {
      if (error instanceof FetchRefusedError) return fallback(error.reason);
      return fallback('fetch-failed');
    }
  }

  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return notFound();
    const requestUrl = new URL(request.url);
    const hash = requestUrl.pathname.startsWith(`${basePath}/`)
      ? requestUrl.pathname.slice(basePath.length + 1)
      : '';
    const logoUri = requestUrl.searchParams.get('src');
    if (!logoUri || !/^[0-9a-f]{32}$/.test(hash) || hash !== (await logoHash(logoUri)))
      return notFound();

    const edgeCache = options.edgeCache === undefined ? workersDefaultCache() : options.edgeCache;
    const cacheKey = new Request(requestUrl.toString(), { method: 'GET' });
    const cached = await edgeCache?.match(cacheKey);
    if (cached) return cached;

    const response = await fetchLogo(logoUri);
    await edgeCache?.put(cacheKey, response.clone());
    return response;
  };
}
