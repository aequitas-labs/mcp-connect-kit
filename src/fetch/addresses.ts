import ipaddr from 'ipaddr.js';

import { isLoopbackHost } from '../clients/redirects.js';

/**
 * Looks up every address a host name resolves to. The kit refuses the fetch
 * if any of them is private, so return all of them, not just the first.
 */
export type ResolveHost = (hostname: string) => Promise<readonly string[]>;

/**
 * Whether an IP address is ordinary public unicast. Private, loopback,
 * link-local, carrier-grade NAT, multicast, reserved and documentation
 * ranges are all refused, as are IPv6 forms that embed an IPv4 address
 * (mapped, 6to4, Teredo, NAT64), since the embedded address may be private.
 */
export function isPublicAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  return ipaddr.process(address).range() === 'unicast';
}

/** The host name without IPv6 brackets, as `URL` gives it. */
function bareHost(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

/**
 * Returns the reason a host can't be fetched, or `null` when it can. An IP
 * literal is checked directly. A name is resolved with `resolveHost` when one
 * is given; without one, only names that always mean this computer are
 * refused, and the platform's own network has to keep private addresses
 * out of reach (Cloudflare Workers does).
 */
export async function hostRefusal(
  hostname: string,
  resolveHost?: ResolveHost,
): Promise<string | null> {
  const host = bareHost(hostname);
  if (ipaddr.isValid(host)) return isPublicAddress(host) ? null : `${host} is not a public address`;
  if (isLoopbackHost(host)) return `${host} is this computer`;
  if (!resolveHost) return null;
  const addresses = await resolveHost(host);
  if (addresses.length === 0) return `${host} has no addresses`;
  const blocked = addresses.find((address) => !isPublicAddress(address));
  return blocked ? `${host} resolves to ${blocked}, which is not public` : null;
}
