/**
 * Where a known client's authorization codes go. A match proves the code
 * reaches that product, whoever registered the client.
 */
export interface RedirectRule {
  /** The URL scheme, with its colon. Defaults to `https:`. */
  readonly scheme?: string;
  /** The exact host name, with no port. */
  readonly host: string;
  /** The path to compare against the redirect's path. */
  readonly path: string;
  /** `exact` accepts only `path`; `prefix` accepts any path that starts with it. */
  readonly match: 'exact' | 'prefix';
}

/**
 * A client the kit can name with confidence. Every field is a fact the server
 * can check, except `name` and `brandNames`, which are what the screens show
 * and what an impostor might copy.
 */
export interface KnownClient {
  /** A stable id, such as `chatgpt`. Apps key their own marks by it. */
  readonly id: string;
  /** The name the screens show, such as `ChatGPT`. */
  readonly name: string;
  /**
   * Client ID metadata document URLs the product publishes. Each is an exact
   * URL, or a pattern where `{id}` stands for one path segment, as in
   * `https://chatgpt.com/oauth/{id}/client.json`.
   */
  readonly metadataUrls?: readonly string[];
  /** Redirects only this product receives. Loopback redirects never belong here. */
  readonly redirects?: readonly RedirectRule[];
  /** Hosts this client's `logo_uri` may point at. The kit fetches logos from no other host. */
  readonly logoHosts?: readonly string[];
  /**
   * Words an impostor would use to pass as this product, such as `chatgpt`
   * and `openai`. An unrecognised client whose name contains one gets the
   * `name-claims-known-brand` warning. Compared case-insensitively, ignoring
   * spaces and punctuation.
   */
  readonly brandNames?: readonly string[];
  /**
   * Exact names this product uses when it can only be known by name, such as
   * `Gemini CLI MCP Client`. Such a client stays unrecognised, but its own
   * name doesn't count as claiming the brand.
   */
  readonly selfNames?: readonly string[];
}

/** How the kit knows who the client is. */
export type RecognitionSource = 'metadata-url' | 'redirect' | 'none';

/**
 * What the screens may show as the client's picture: the logo from its
 * metadata document, a mark the app or the kit holds for its id, or a neutral
 * icon.
 */
export type LogoSource = 'metadata' | 'mark' | 'none';

/** Things the person should know before allowing the client. */
export type ClientWarning =
  /** No known client matched the metadata URL or the redirect. */
  | 'unknown-client'
  /** The person goes back to an address on their own computer, which any program can listen on. */
  | 'localhost-only'
  /** An unrecognised client's name contains a known product's name. */
  | 'name-claims-known-brand'
  /** The metadata document's logo is on a host the client's entry doesn't list. */
  | 'logo-host-differs';

/** The kit's verdict on who is connecting. */
export interface ClientIdentity {
  /** The known client's id, or `null` when no checked fact matched. */
  readonly id: string | null;
  /**
   * The name to show. A known client's own name, or else the name the client
   * sent, which the screens show in quotes.
   */
  readonly name: string;
  /** How the kit knows. `none` means `name` is only what the client said. */
  readonly via: RecognitionSource;
  /** The host the person returns to after deciding, from this request's redirect. */
  readonly returnHost: string;
  /** What to show as the client's picture. */
  readonly logo: LogoSource;
  /** The logo URL to fetch through the logo route, when `logo` is `metadata`. */
  readonly logoUri: string | null;
  /** In the order the screens should show them. */
  readonly warnings: readonly ClientWarning[];
}
