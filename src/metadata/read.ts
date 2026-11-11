import { parseUrl } from '../clients/redirects.js';

/** A client metadata document after the kit has checked and normalised it. */
export interface ClientMetadataDocument {
  /** Equal to the URL the document was fetched from. */
  readonly client_id: string;
  readonly client_name?: string;
  readonly client_uri?: string;
  /** Kept only when it is an HTTPS URL. Fetch it only through the logo route. */
  readonly logo_uri?: string;
  readonly redirect_uris: readonly string[];
  /** Only the grants the server offers. */
  readonly grant_types: readonly string[];
  readonly response_types: readonly string[];
  readonly token_endpoint_auth_method: string;
  readonly application_type?: 'web' | 'native';
  readonly jwks_uri?: string;
  readonly jwks?: Readonly<Record<string, unknown>>;
  readonly token_endpoint_auth_signing_alg?: string;
  readonly scope?: string;
}

/** What the server offers, which the document is held to. */
export interface ClientMetadataPolicy {
  /** The URL the document was fetched from. The document's `client_id` must equal it. */
  readonly url: string;
  /** Grant types the server offers, such as `authorization_code` and `refresh_token`. */
  readonly grants: readonly string[];
  /** Token endpoint auth methods the server accepts, such as `none` and `private_key_jwt`. */
  readonly authMethods: readonly string[];
  /** Response types the server offers. Defaults to `code`. */
  readonly responseTypes?: readonly string[];
}

/**
 * The document can't be used. `code` is the OAuth error to return
 * (RFC 7591 §3.2.2), and the message says why, for logs.
 */
export class ClientMetadataError extends Error {
  override readonly name = 'ClientMetadataError';
  readonly code = 'invalid_client_metadata';
}

const MAX_REDIRECT_URIS = 20;
const MAX_NAME_LENGTH = 200;
/** A client metadata document must not carry a shared secret (CIMD §4.1). */
const SECRET_FIELDS: readonly string[] = ['client_secret', 'client_secret_expires_at'];
const SECRET_AUTH_METHODS: readonly string[] = [
  'client_secret_basic',
  'client_secret_post',
  'client_secret_jwt',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === 'string')) {
    throw new ClientMetadataError(`${field} must be a list of strings`);
  }
  return value;
}

function httpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const url = parseUrl(value);
  return url?.protocol === 'https:' && !url.username && !url.password ? value : undefined;
}

/**
 * Checks and normalises a client ID metadata document fetched from
 * `policy.url`. It keeps only the grant and response types the server
 * offers, so a vendor adding a new grant doesn't make the whole document
 * fail. It refuses the document when nothing usable is left.
 *
 * @throws {ClientMetadataError} when the document can't be used.
 */
export function readClientMetadata(
  raw: unknown,
  policy: ClientMetadataPolicy,
): ClientMetadataDocument {
  if (!isRecord(raw)) throw new ClientMetadataError('The document must be a JSON object');
  if (raw.client_id !== policy.url) {
    throw new ClientMetadataError(
      `client_id ${String(raw.client_id)} differs from the document URL ${policy.url}`,
    );
  }
  for (const field of SECRET_FIELDS) {
    if (field in raw)
      throw new ClientMetadataError(`A metadata document must not include ${field}`);
  }

  const redirectUris = stringList(raw.redirect_uris, 'redirect_uris') ?? [];
  if (redirectUris.length === 0 || redirectUris.length > MAX_REDIRECT_URIS) {
    throw new ClientMetadataError(
      `redirect_uris must list between 1 and ${MAX_REDIRECT_URIS} URIs`,
    );
  }
  for (const redirectUri of redirectUris) {
    const url = parseUrl(redirectUri);
    if (!url || url.hash || url.username || url.password) {
      throw new ClientMetadataError(`redirect URI ${redirectUri} is not a valid redirect`);
    }
  }

  const listedGrants = stringList(raw.grant_types, 'grant_types') ?? ['authorization_code'];
  const grantTypes = listedGrants.filter((grant) => policy.grants.includes(grant));
  if (grantTypes.length === 0) {
    throw new ClientMetadataError(`None of the grant types ${listedGrants.join(', ')} are offered`);
  }

  const offeredResponseTypes = policy.responseTypes ?? ['code'];
  const listedResponseTypes = stringList(raw.response_types, 'response_types') ?? ['code'];
  const responseTypes = listedResponseTypes.filter((type) => offeredResponseTypes.includes(type));
  if (responseTypes.length === 0) {
    throw new ClientMetadataError(
      `None of the response types ${listedResponseTypes.join(', ')} are offered`,
    );
  }

  const authMethod = raw.token_endpoint_auth_method ?? 'none';
  if (typeof authMethod !== 'string' || SECRET_AUTH_METHODS.includes(authMethod)) {
    throw new ClientMetadataError(
      `token_endpoint_auth_method ${String(authMethod)} needs a shared secret`,
    );
  }
  if (!policy.authMethods.includes(authMethod)) {
    throw new ClientMetadataError(`token_endpoint_auth_method ${authMethod} is not accepted`);
  }

  const name = raw.client_name;
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim() || name.length > MAX_NAME_LENGTH) {
      throw new ClientMetadataError(
        `client_name must be text of at most ${MAX_NAME_LENGTH} characters`,
      );
    }
    // Control and format characters can hide or reorder a name on the consent screen.
    if (/[\p{Cc}\p{Cf}]/u.test(name))
      throw new ClientMetadataError('client_name contains hidden characters');
  }

  const applicationType =
    raw.application_type === 'web' || raw.application_type === 'native'
      ? raw.application_type
      : undefined;
  const optional: Partial<Record<keyof ClientMetadataDocument, unknown>> = {
    client_name: name,
    client_uri: httpsUrl(raw.client_uri),
    logo_uri: httpsUrl(raw.logo_uri),
    application_type: applicationType,
    jwks_uri: httpsUrl(raw.jwks_uri),
    jwks: isRecord(raw.jwks) ? raw.jwks : undefined,
    token_endpoint_auth_signing_alg:
      typeof raw.token_endpoint_auth_signing_alg === 'string'
        ? raw.token_endpoint_auth_signing_alg
        : undefined,
    scope: typeof raw.scope === 'string' ? raw.scope : undefined,
  };
  const present = Object.fromEntries(
    Object.entries(optional).filter(([, value]) => value !== undefined),
  );

  return {
    client_id: policy.url,
    redirect_uris: redirectUris,
    grant_types: grantTypes,
    response_types: responseTypes,
    token_endpoint_auth_method: authMethod,
    ...present,
  } as ClientMetadataDocument;
}
