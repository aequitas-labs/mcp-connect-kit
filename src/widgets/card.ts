/** The MIME type of an MCP Apps resource. Hosts render only resources of this type. */
export const CARD_MIME_TYPE = 'text/html;profile=mcp-app';

/**
 * A widget template: one self-contained HTML file, named by its content.
 * `uri` is `ui://<app>/<name>-<revision>.html`, where the revision is the
 * first 16 hex digits of the HTML's SHA-256, so a changed card gets a new URI.
 */
export interface Card {
  readonly app: string;
  readonly name: string;
  readonly uri: string;
  readonly html: string;
  readonly mimeType: typeof CARD_MIME_TYPE;
  /** Shown to the host, such as "Runhome Estimate". Defaults to the name. */
  readonly title?: string;
  /** Tells ChatGPT what the card shows. */
  readonly description?: string;
}

/** What `defineCard` takes: a card from `buildCard`, or your own HTML with its URI. */
export interface CardInput {
  readonly app: string;
  readonly name: string;
  readonly uri: string;
  readonly html: string;
  readonly title?: string;
  readonly description?: string;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Thrown when a card's name or URI would break the old-URI rule. */
export class CardError extends TypeError {
  override readonly name = 'CardError';
}

/** The URI pattern that answers every revision of a card. */
export function cardUriTemplate(app: string, name: string): string {
  return `ui://${app}/${name}-{revision}.html`;
}

/** The content revision of a card's HTML: the first 16 hex digits of its SHA-256. */
export async function cardRevision(html: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(html));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

/** The URI for a card's current HTML. */
export async function cardUri(app: string, name: string, html: string): Promise<string> {
  return `ui://${app}/${name}-${await cardRevision(html)}.html`;
}

/**
 * Checks a card and returns it frozen. The URI must follow
 * `ui://<app>/<name>-<revision>.html`, which is what lets older URIs keep
 * resolving after a deploy.
 */
export function defineCard(input: CardInput): Card {
  if (!SLUG.test(input.app) || !SLUG.test(input.name)) {
    throw new CardError(
      `App ${input.app} and card ${input.name} must be lowercase words joined by hyphens`,
    );
  }
  const pattern = new RegExp(`^ui://${input.app}/${input.name}-[0-9a-f]{8,64}\\.html$`);
  if (!pattern.test(input.uri)) {
    throw new CardError(
      `${input.uri} must look like ui://${input.app}/${input.name}-<revision>.html`,
    );
  }
  if (!input.html.trim()) throw new CardError(`${input.name} has no HTML`);
  return Object.freeze({ ...input, mimeType: CARD_MIME_TYPE });
}
