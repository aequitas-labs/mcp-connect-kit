import type { RedirectRule } from './types.js';

/** Host names that always mean "this computer". */
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Parses a URL, or returns `null` for anything `URL` refuses. */
export function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** Whether a host name is a loopback address, including any `*.localhost` name. */
export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    LOOPBACK_HOSTS.has(host) || host.endsWith('.localhost') || /^127(\.\d{1,3}){3}$/.test(host)
  );
}

/**
 * Whether a redirect returns to this computer over HTTP, where any program
 * can listen. An unparseable redirect counts as loopback, so it never earns
 * trust.
 */
export function isLoopbackRedirect(redirectUri: string): boolean {
  const url = parseUrl(redirectUri);
  if (!url) return true;
  return (url.protocol === 'http:' || url.protocol === 'https:') && isLoopbackHost(url.hostname);
}

/** Whether a redirect matches one of a known client's rules. */
export function matchesRedirectRule(redirectUri: string, rule: RedirectRule): boolean {
  const url = parseUrl(redirectUri);
  if (!url || url.username || url.password || url.port) return false;
  const scheme = rule.scheme ?? 'https:';
  if (url.protocol !== scheme || url.hostname.toLowerCase() !== rule.host) return false;
  if (url.protocol === 'https:' && isLoopbackHost(url.hostname)) return false;
  return rule.match === 'exact' ? url.pathname === rule.path : url.pathname.startsWith(rule.path);
}

/**
 * Whether a requested loopback redirect matches a registered one. Native apps
 * register `http://127.0.0.1/callback` and listen on whatever port is free, so
 * RFC 8252 §7.3 says to ignore the port. Scheme, host and path must still match.
 */
export function loopbackRedirectMatcher(registered: string, requested: string): boolean {
  const registeredUrl = parseUrl(registered);
  const requestedUrl = parseUrl(requested);
  if (!registeredUrl || !requestedUrl) return false;
  if (registeredUrl.protocol !== 'http:' || requestedUrl.protocol !== 'http:') return false;
  if (!isLoopbackHost(registeredUrl.hostname)) return false;
  return (
    registeredUrl.hostname === requestedUrl.hostname &&
    registeredUrl.pathname === requestedUrl.pathname &&
    registeredUrl.search === requestedUrl.search &&
    !requestedUrl.username &&
    !requestedUrl.password &&
    !requestedUrl.hash
  );
}
