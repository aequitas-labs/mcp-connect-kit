/**
 * mcp-connect-kit/better-auth: connects the kit to Better Auth's
 * oauth-provider and `@better-auth/cimd` plugins.
 */
import { identifyClient } from '../clients/identify.js';
import type { ClientIdentity, KnownClient } from '../clients/types.js';
import { hostRefusal } from '../fetch/addresses.js';
import { FetchRefusedError } from '../fetch/errors.js';
import type { Transport } from '../fetch/guarded-fetch.js';
import { DEFAULT_LOGO_BASE_PATH, logoPath } from '../logo/proxy.js';

/** Better Auth's transport for metadata documents and the resources they point at, such as `jwks_uri`. */
export type ClientMetadataResourceFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/** Options for `cimdOptions`. */
export interface CimdAdapterOptions extends Transport {
  /** The grant types your server offers. A document's other grants are dropped before Better Auth sees them. */
  readonly grants: readonly string[];
}

/** The part of `@better-auth/cimd`'s options the kit fills in. */
export interface KitCimdOptions {
  readonly fetchClientMetadataResource: ClientMetadataResourceFetch;
  readonly metadataProfile: 'mcp-2026-07-28';
}

const MAX_METADATA_BYTES = 5 * 1024;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * Options for `@better-auth/cimd`: `cimd({ ...cimdOptions({ ...nodeTransport, grants }) })`.
 *
 * The transport refuses private addresses and redirects, as the plugin
 * requires; on Node, `nodeTransport` also pins the connection. A metadata
 * document's `grant_types` are cut to the grants you offer, so a vendor
 * adding a grant, as ChatGPT did with `jwt-bearer`, doesn't refuse the whole
 * document. Other resources pass through untouched.
 */
export function cimdOptions(options: CimdAdapterOptions): KitCimdOptions {
  const fetchFunction = options.fetch ?? ((input: URL, init: RequestInit) => fetch(input, init));
  const fetchClientMetadataResource: ClientMetadataResourceFetch = async (input, init) => {
    const url = requestUrl(input);
    const target = new URL(url);
    if (target.protocol !== 'https:')
      throw new FetchRefusedError('not-https', `${url} is not HTTPS`);
    const refusal = await hostRefusal(target.hostname, options.resolveHost);
    if (refusal) throw new FetchRefusedError('private-address', refusal);
    const response = await fetchFunction(target, {
      ...init,
      redirect: 'manual',
      credentials: 'omit',
    });
    const type = response.headers.get('content-type') ?? '';
    if (response.status !== 200 || !/json/i.test(type)) return response;
    if (Number(response.headers.get('content-length')) > MAX_METADATA_BYTES) return response;

    const text = await response.text();
    const passThrough = (): Response =>
      new Response(text, { status: response.status, headers: response.headers });
    if (text.length > MAX_METADATA_BYTES) return passThrough();
    let document: unknown;
    try {
      document = JSON.parse(text);
    } catch {
      return passThrough();
    }
    if (
      typeof document !== 'object' ||
      document === null ||
      (document as { client_id?: unknown }).client_id !== url ||
      !Array.isArray((document as { grant_types?: unknown }).grant_types)
    ) {
      return passThrough();
    }
    const listed = (document as { grant_types: unknown[] }).grant_types;
    const offered = listed.filter(
      (grant) => typeof grant === 'string' && options.grants.includes(grant),
    );
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    return new Response(JSON.stringify({ ...document, grant_types: offered }), {
      status: 200,
      headers,
    });
  };
  return { fetchClientMetadataResource, metadataProfile: 'mcp-2026-07-28' };
}

/** The fields of Better Auth's stored OAuth client that the consent screen needs. */
export interface BetterAuthClientRecord {
  readonly clientId: string;
  readonly name?: string | undefined;
  readonly icon?: string | undefined;
  readonly redirectUris?: readonly string[] | undefined;
  /** Set when the client came from a metadata document rather than dynamic registration. */
  readonly clientDiscoveryId?: string | null | undefined;
}

/** What a consent page needs: who is connecting, and where to load its logo from. */
export interface ConsentContext {
  readonly client: ClientIdentity;
  /** The logo route path for `ConsentView`'s `logoSrc`, when the client's own logo can be shown. */
  readonly logoSrc: string | undefined;
}

/**
 * Builds the consent screen's context from Better Auth's stored client and
 * this request's redirect. A client ID counts as a metadata document URL only
 * when Better Auth discovered the client from that document.
 */
export async function consentContext(input: {
  readonly client: BetterAuthClientRecord;
  readonly redirectUri: string;
  readonly clients?: readonly KnownClient[];
  readonly logoBasePath?: string;
}): Promise<ConsentContext> {
  const { client } = input;
  const discovered = Boolean(client.clientDiscoveryId);
  const identity = identifyClient({
    clientId: discovered ? client.clientId : `registered:${client.clientId}`,
    redirectUri: input.redirectUri,
    metadata: {
      client_name: client.name,
      logo_uri: client.icon,
      redirect_uris: client.redirectUris ?? [],
    },
    clients: input.clients,
  });
  const logoSrc =
    identity.logo === 'metadata' && identity.logoUri
      ? await logoPath(identity.logoUri, input.logoBasePath ?? DEFAULT_LOGO_BASE_PATH)
      : undefined;
  return { client: identity, logoSrc };
}
