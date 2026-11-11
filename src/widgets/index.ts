/**
 * mcp-connect-kit/widgets: MCP Apps cards whose URIs change with their
 * content, while every earlier URI keeps answering with the current card.
 */
export {
  CARD_MIME_TYPE,
  CardError,
  cardRevision,
  cardUri,
  cardUriTemplate,
  defineCard,
} from './card.js';
export type { Card, CardInput } from './card.js';
export { cardResourceMeta, cardToolMeta, registerCards } from './register.js';
export type { CardSecurityPolicy, RegisterCardsOptions } from './register.js';
