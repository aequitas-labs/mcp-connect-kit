import { isLoopbackHost, parseUrl } from './redirects.js';
import type { KnownClient, RedirectRule } from './types.js';

const CLIENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HOST_PATTERN = /^[a-z0-9.-]+$/;

/** Thrown when a client entry would match something it shouldn't. */
export class KnownClientError extends TypeError {
  override readonly name = 'KnownClientError';
}

function checkMetadataUrl(clientId: string, metadataUrl: string): void {
  const url = parseUrl(metadataUrl.replaceAll('{id}', 'id'));
  if (!url || url.protocol !== 'https:' || url.port || url.search || url.hash || url.username) {
    throw new KnownClientError(
      `${clientId}: metadata URL ${metadataUrl} must be a plain HTTPS URL with no port, query or fragment`,
    );
  }
  if (isLoopbackHost(url.hostname)) {
    throw new KnownClientError(`${clientId}: metadata URL ${metadataUrl} is on this computer`);
  }
  if (metadataUrl.split('/').slice(0, 3).join('/').includes('{id}')) {
    throw new KnownClientError(
      `${clientId}: {id} may only stand for a path segment in ${metadataUrl}`,
    );
  }
}

function checkRedirect(clientId: string, rule: RedirectRule): void {
  const scheme = rule.scheme ?? 'https:';
  if (!scheme.endsWith(':') || scheme === 'http:') {
    throw new KnownClientError(
      `${clientId}: redirect scheme ${scheme} can't prove who receives the code`,
    );
  }
  if (!HOST_PATTERN.test(rule.host) || isLoopbackHost(rule.host)) {
    throw new KnownClientError(
      `${clientId}: redirect host ${rule.host} must be a lowercase public host name`,
    );
  }
  if (!rule.path.startsWith('/')) {
    throw new KnownClientError(`${clientId}: redirect path ${rule.path} must start with /`);
  }
}

/**
 * Checks a client entry and returns it frozen. Use it for your own clients,
 * such as a partner's agent that publishes a metadata document.
 *
 * Refuses rules that would prove nothing: loopback hosts, plain HTTP
 * redirects, and metadata URLs that aren't HTTPS.
 */
export function defineClient(client: KnownClient): KnownClient {
  if (!CLIENT_ID_PATTERN.test(client.id)) {
    throw new KnownClientError(`Client id ${client.id} must be lowercase words joined by hyphens`);
  }
  if (!client.name.trim()) throw new KnownClientError(`${client.id}: name must not be empty`);
  if (!client.metadataUrls?.length && !client.redirects?.length && !client.selfNames?.length) {
    throw new KnownClientError(`${client.id}: needs a metadata URL, a redirect or a self name`);
  }
  for (const metadataUrl of client.metadataUrls ?? []) checkMetadataUrl(client.id, metadataUrl);
  for (const rule of client.redirects ?? []) checkRedirect(client.id, rule);
  for (const host of client.logoHosts ?? []) {
    if (!HOST_PATTERN.test(host) || isLoopbackHost(host)) {
      throw new KnownClientError(
        `${client.id}: logo host ${host} must be a lowercase public host name`,
      );
    }
  }
  return Object.freeze({ ...client });
}
