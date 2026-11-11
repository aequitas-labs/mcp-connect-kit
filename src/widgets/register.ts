import { registerAppResource } from '@modelcontextprotocol/ext-apps/server';
import { ResourceTemplate } from '@modelcontextprotocol/server';
import type { McpServer } from '@modelcontextprotocol/server';

import { cardUriTemplate } from './card.js';
import type { Card } from './card.js';

/** The origins a card may reach, in the MCP Apps names. */
export interface CardSecurityPolicy {
  /** Origins for fetch and WebSocket. */
  readonly connectDomains?: readonly string[];
  /** Origins for images, fonts, scripts and styles. */
  readonly resourceDomains?: readonly string[];
  /** Origins the card may embed in a frame. */
  readonly frameDomains?: readonly string[];
  /** Origins ChatGPT may open with `openExternal`. ChatGPT only. */
  readonly redirectDomains?: readonly string[];
}

/** What reading a card returns: its HTML, with the card's `_meta`. */
export interface CardReadResult {
  readonly [key: string]: unknown;
  contents: { uri: string; mimeType: string; text: string; _meta: Record<string, unknown> }[];
}

/** Options for `registerCards`. */
export interface RegisterCardsOptions {
  /** The card's own origin, such as `https://cards.runhome.com`. */
  readonly domain: string;
  readonly csp?: CardSecurityPolicy;
  /** Ask the host to draw a border round the card. Defaults to true. */
  readonly prefersBorder?: boolean;
}

/** Resource `_meta` in both dialects: MCP Apps (`ui`) and ChatGPT's `openai/*` aliases, which it still reads. */
export function cardResourceMeta(
  card: Card,
  options: RegisterCardsOptions,
): Record<string, unknown> {
  const csp = options.csp ?? {};
  const prefersBorder = options.prefersBorder ?? true;
  return {
    ui: {
      domain: options.domain,
      csp: {
        connectDomains: [...(csp.connectDomains ?? [])],
        resourceDomains: [...(csp.resourceDomains ?? [])],
        frameDomains: [...(csp.frameDomains ?? [])],
      },
      prefersBorder,
    },
    'openai/widgetDomain': options.domain,
    'openai/widgetCSP': {
      connect_domains: [...(csp.connectDomains ?? [])],
      resource_domains: [...(csp.resourceDomains ?? [])],
      frame_domains: [...(csp.frameDomains ?? [])],
      redirect_domains: [...(csp.redirectDomains ?? [])],
    },
    'openai/widgetPrefersBorder': prefersBorder,
    ...(card.description ? { 'openai/widgetDescription': card.description } : {}),
  };
}

/**
 * Tool `_meta` that points a tool at a card, in both dialects: MCP Apps'
 * `ui.resourceUri` (and the older `ui/resourceUri`) and ChatGPT's
 * `openai/outputTemplate`.
 */
export function cardToolMeta(
  card: Card,
  options: { readonly visibility?: readonly ('model' | 'app')[] } = {},
): Record<string, unknown> {
  return {
    ui: {
      resourceUri: card.uri,
      ...(options.visibility ? { visibility: [...options.visibility] } : {}),
    },
    'ui/resourceUri': card.uri,
    'openai/outputTemplate': card.uri,
    'openai/widgetAccessible': true,
  };
}

/**
 * Registers each card on an MCP server. `resources/list` shows only each
 * card's current URI. An unlisted template, `ui://<app>/<name>-{revision}.html`,
 * answers any earlier revision with the current HTML.
 *
 * Hosts cache a card by its URI and keep the URIs they read when the
 * connector was added. Without the template, a deploy that changes a card
 * leaves those hosts asking for a URI that no longer exists, and the card
 * fails to open.
 */
export function registerCards(
  server: McpServer,
  cards: readonly Card[],
  options: RegisterCardsOptions,
): void {
  for (const card of cards) {
    const meta = cardResourceMeta(card, options);
    const title = card.title ?? card.name;
    const read = (uri: string): CardReadResult => ({
      contents: [{ uri, mimeType: card.mimeType, text: card.html, _meta: meta }],
    });
    registerAppResource(
      server,
      `${card.app}-${card.name}`,
      card.uri,
      {
        title,
        mimeType: card.mimeType,
        ...(card.description ? { description: card.description } : {}),
        _meta: meta,
      },
      async () => read(card.uri),
    );
    server.registerResource(
      `${card.app}-${card.name}-earlier-revision`,
      new ResourceTemplate(cardUriTemplate(card.app, card.name), { list: undefined }),
      {
        title,
        mimeType: card.mimeType,
        description: `An earlier revision of ${title}.`,
        _meta: meta,
      },
      async (uri: URL) => read(uri.href),
    );
  }
}
