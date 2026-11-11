import { FetchRefusedError } from './errors.js';
import { guardedFetch } from './guarded-fetch.js';
import type { Transport } from './guarded-fetch.js';

/** Options for `createMetadataFetcher`. */
export interface MetadataFetcherOptions extends Transport {
  /** Defaults to 3000 ms. */
  readonly timeoutMs?: number;
  /** Defaults to 5 KB, the limit the CIMD draft sets. */
  readonly maxBytes?: number;
}

/** Fetches a client ID metadata document and returns its parsed JSON, unchecked. */
export type MetadataFetcher = (url: string) => Promise<unknown>;

const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_MAX_METADATA_BYTES = 5 * 1024;

function isJsonType(contentType: string): boolean {
  const type = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return type === 'application/json' || type.endsWith('+json');
}

/**
 * Makes a fetcher for client ID metadata documents. It fetches over HTTPS
 * only, refuses private addresses and redirects, accepts only a 200 JSON
 * response of at most 5 KB, and keeps nothing: `@better-auth/cimd` stores the
 * document with its client. Pass the result to `readClientMetadata`.
 */
export function createMetadataFetcher(options: MetadataFetcherOptions = {}): MetadataFetcher {
  const limits = {
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxBytes: options.maxBytes ?? DEFAULT_MAX_METADATA_BYTES,
    accept: 'application/json',
  };
  return async (url: string): Promise<unknown> => {
    const { bytes, contentType } = await guardedFetch(url, limits, options);
    if (!isJsonType(contentType)) {
      throw new FetchRefusedError(
        'bad-content-type',
        `${url} is ${contentType || 'untyped'}, not JSON`,
      );
    }
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
    } catch {
      throw new FetchRefusedError('invalid-json', `${url} is not valid JSON`);
    }
  };
}
