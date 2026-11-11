import { hostRefusal } from './addresses.js';
import type { ResolveHost } from './addresses.js';
import { FetchRefusedError } from './errors.js';

/** A `fetch`-shaped function. Defaults to the runtime's own `fetch`. */
export type FetchFunction = (input: URL, init: RequestInit) => Promise<Response>;

/** How the kit reaches the network. */
export interface Transport {
  /**
   * Resolves a host name to all its addresses. On Node, use the one from
   * `mcp-connect-kit/node`. Leave it out on Cloudflare Workers.
   */
  readonly resolveHost?: ResolveHost | undefined;
  /**
   * The fetch to use. `mcp-connect-kit/node` has one that connects only to
   * the addresses it checked, which closes the gap between the check and
   * the connection.
   */
  readonly fetch?: FetchFunction | undefined;
}

/** Limits for one guarded fetch. */
export interface GuardedFetchLimits {
  readonly maxBytes: number;
  readonly timeoutMs: number;
  /** Sent as the `Accept` header. */
  readonly accept: string;
}

/** The body and type of a fetched resource that passed every check. */
export interface GuardedFetchResult {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly contentType: string;
}

async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(response.headers.get('content-length'));
  if (declared > maxBytes) {
    await response.body?.cancel();
    throw new FetchRefusedError('too-large', `The response is ${declared} bytes, over ${maxBytes}`);
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new FetchRefusedError('too-large', `The response is over ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * Fetches an HTTPS URL the way a server should fetch a URL a stranger chose:
 * no cookies, no redirects, only public addresses, a deadline and a size cap.
 * Only a 200 response is accepted.
 *
 * @throws {FetchRefusedError} when any check fails. No connection is opened
 *   when the URL or its addresses are refused.
 */
export async function guardedFetch(
  url: string,
  limits: GuardedFetchLimits,
  transport: Transport = {},
): Promise<GuardedFetchResult> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new FetchRefusedError('not-https', `${url} is not a URL`);
  }
  if (target.protocol !== 'https:' || target.username || target.password) {
    throw new FetchRefusedError('not-https', `${url} is not a plain HTTPS URL`);
  }
  const refusal = await hostRefusal(target.hostname, transport.resolveHost);
  if (refusal) throw new FetchRefusedError('private-address', refusal);

  const fetchFunction: FetchFunction = transport.fetch ?? ((input, init) => fetch(input, init));
  let response: Response;
  try {
    response = await fetchFunction(target, {
      method: 'GET',
      redirect: 'manual',
      credentials: 'omit',
      headers: { accept: limits.accept },
      signal: AbortSignal.timeout(limits.timeoutMs),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new FetchRefusedError('timeout', `${url} took longer than ${limits.timeoutMs} ms`);
    }
    throw error;
  }
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel();
    throw new FetchRefusedError('redirect', `${url} redirects, and redirects are not followed`);
  }
  if (response.status !== 200) {
    await response.body?.cancel();
    throw new FetchRefusedError('bad-status', `${url} answered ${response.status}`);
  }
  try {
    const bytes = await readCapped(response, limits.maxBytes);
    return { bytes, contentType: response.headers.get('content-type') ?? '' };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new FetchRefusedError('timeout', `${url} took longer than ${limits.timeoutMs} ms`);
    }
    throw error;
  }
}
