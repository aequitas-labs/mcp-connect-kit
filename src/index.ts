/**
 * mcp-connect-kit: recognise the MCP client that's connecting, from facts the
 * server can check, and read its client ID metadata document safely.
 */
export { defineClient, KnownClientError } from './clients/define.js';
export {
  chatgpt,
  claude,
  claudeCode,
  codex,
  cursor,
  defaultClients,
  geminiApp,
  geminiCli,
  unverifiedClients,
  vscode,
} from './clients/defaults.js';
export { identifyClient } from './clients/identify.js';
export type { ClientFacts, ClientMetadataFacts } from './clients/identify.js';
export { isLoopbackRedirect, loopbackRedirectMatcher } from './clients/redirects.js';
export type {
  ClientIdentity,
  ClientWarning,
  KnownClient,
  LogoSource,
  RecognitionSource,
  RedirectRule,
} from './clients/types.js';
export { ClientMetadataError, readClientMetadata } from './metadata/read.js';
export type { ClientMetadataDocument, ClientMetadataPolicy } from './metadata/read.js';
