import { defaultClients } from './defaults.js';
import { isLoopbackRedirect, matchesRedirectRule, parseUrl } from './redirects.js';
import type {
  ClientIdentity,
  ClientWarning,
  KnownClient,
  LogoSource,
  RecognitionSource,
} from './types.js';

/** The fields of a stored registration or metadata document that recognition reads. */
export interface ClientMetadataFacts {
  readonly client_name?: string | undefined;
  readonly redirect_uris?: readonly string[] | undefined;
  readonly logo_uri?: string | undefined;
}

/** The facts the authorization server has about this request. */
export interface ClientFacts {
  /**
   * The client ID. For a metadata document client this is the document's
   * URL, which the server has already fetched and checked.
   */
  readonly clientId: string;
  /** The redirect URI of this authorization request, after the server accepted it. */
  readonly redirectUri: string;
  /** The stored metadata document or dynamic registration, if any. */
  readonly metadata?: ClientMetadataFacts | null | undefined;
  /** The clients to recognise. Defaults to `defaultClients`. */
  readonly clients?: readonly KnownClient[] | undefined;
}

const MAX_NAME_LENGTH = 100;

/** Removes characters that can hide or reorder a name on screen, and trims it to a sane length. */
function cleanName(name: string | undefined): string {
  const cleaned = (name ?? '').replace(/[\p{Cc}\p{Cf}]/gu, '').trim();
  return cleaned.length > MAX_NAME_LENGTH ? `${cleaned.slice(0, MAX_NAME_LENGTH - 1)}…` : cleaned;
}

/** Lowercases and drops everything but letters and digits, so `Chat-GPT` reads as `chatgpt`. */
function brandKey(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function metadataUrlPattern(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replaceAll('{id}', '[A-Za-z0-9_-]+')}$`);
}

/** Finds the client that publishes this metadata URL. Exact URLs win over `{id}` patterns. */
function findByMetadataUrl(
  clientId: string,
  clients: readonly KnownClient[],
): KnownClient | undefined {
  return (
    clients.find((client) =>
      client.metadataUrls?.some((url) => !url.includes('{id}') && url === clientId),
    ) ??
    clients.find((client) =>
      client.metadataUrls?.some(
        (url) => url.includes('{id}') && metadataUrlPattern(url).test(clientId),
      ),
    )
  );
}

function findByRedirect(
  redirectUri: string,
  clients: readonly KnownClient[],
): KnownClient | undefined {
  return clients.find((client) =>
    client.redirects?.some((rule) => matchesRedirectRule(redirectUri, rule)),
  );
}

/** Whether an unrecognised client's name contains a known product's brand. */
function claimsKnownBrand(name: string, clients: readonly KnownClient[]): boolean {
  const key = brandKey(name);
  if (!key) return false;
  return clients.some(
    (client) =>
      !client.selfNames?.includes(name) &&
      (client.brandNames ?? []).some((brand) => key.includes(brandKey(brand))),
  );
}

function logoOnListedHost(logoUri: string | undefined, client: KnownClient): boolean {
  const url = logoUri ? parseUrl(logoUri) : null;
  return Boolean(
    url && url.protocol === 'https:' && !url.port && client.logoHosts?.includes(url.hostname),
  );
}

/**
 * Decides who is connecting from facts the server can check, strongest first:
 * the metadata document URL, then the redirect URI. The name a client sends
 * never earns a known client's name or logo.
 *
 * Pass a client and redirect the authorization server has already accepted.
 * A metadata URL only proves anything once the server has fetched that URL
 * and checked that the document's `client_id` equals it.
 */
export function identifyClient(facts: ClientFacts): ClientIdentity {
  const clients = facts.clients ?? defaultClients;
  const metadata = facts.metadata ?? {};
  const byMetadataUrl = findByMetadataUrl(facts.clientId, clients);
  const byRedirect = byMetadataUrl ? undefined : findByRedirect(facts.redirectUri, clients);
  const known = byMetadataUrl ?? byRedirect ?? null;
  const via: RecognitionSource = byMetadataUrl ? 'metadata-url' : byRedirect ? 'redirect' : 'none';

  const returnHost = parseUrl(facts.redirectUri)?.hostname ?? '';
  const sentName = cleanName(metadata.client_name);
  const name = known ? known.name : sentName || returnHost;

  const warnings: ClientWarning[] = [];
  if (!known) warnings.push('unknown-client');
  if (!known && sentName && claimsKnownBrand(sentName, clients))
    warnings.push('name-claims-known-brand');
  const registeredRedirects = metadata.redirect_uris ?? [];
  if (
    isLoopbackRedirect(facts.redirectUri) ||
    (registeredRedirects.length > 0 && registeredRedirects.every(isLoopbackRedirect))
  ) {
    warnings.push('localhost-only');
  }

  let logo: LogoSource = known ? 'mark' : 'none';
  let logoUri: string | null = null;
  if (known && via === 'metadata-url' && metadata.logo_uri) {
    if (logoOnListedHost(metadata.logo_uri, known)) {
      logo = 'metadata';
      logoUri = metadata.logo_uri;
    } else {
      warnings.push('logo-host-differs');
    }
  }

  return {
    id: known?.id ?? null,
    name,
    via,
    family: known ? (known.family ?? known.id) : null,
    returnHost,
    logo,
    logoUri,
    warnings,
  };
}
