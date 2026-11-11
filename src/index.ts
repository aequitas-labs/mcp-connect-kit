/**
 * mcp-connect-kit: recognise the MCP client that's connecting, from facts the
 * server can check; fetch and read its client ID metadata document safely;
 * and serve its logo from your own domain.
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
export { hostRefusal, isPublicAddress } from './fetch/addresses.js';
export type { ResolveHost } from './fetch/addresses.js';
export { FetchRefusedError } from './fetch/errors.js';
export type { FetchRefusal } from './fetch/errors.js';
export type { FetchFunction, Transport } from './fetch/guarded-fetch.js';
export { createMetadataFetcher } from './fetch/metadata.js';
export type { MetadataFetcher, MetadataFetcherOptions } from './fetch/metadata.js';
export { sniffImage } from './logo/image.js';
export type { SniffedImage } from './logo/image.js';
export {
  createLogoProxy,
  DEFAULT_LOGO_BASE_PATH,
  FALLBACK_CACHE_CONTROL,
  LOGO_CACHE_CONTROL,
  logoPath,
} from './logo/proxy.js';
export type { LogoProxyOptions, LogoRoute } from './logo/proxy.js';
export { ClientMetadataError, readClientMetadata } from './metadata/read.js';
export type { ClientMetadataDocument, ClientMetadataPolicy } from './metadata/read.js';
