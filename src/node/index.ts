/**
 * Node transport for the kit's fetches. `nodeTransport` checks every address
 * a host resolves to, then connects only to an address it checked, so DNS
 * can't change between the check and the connection.
 */
import { lookup as dnsLookup } from 'node:dns';
import type { LookupAddress, LookupAllOptions, LookupOneOptions } from 'node:dns';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import type { IncomingHttpHeaders } from 'node:http';
import type { LookupFunction } from 'node:net';
import { Readable } from 'node:stream';

import { isPublicAddress } from '../fetch/addresses.js';
import type { ResolveHost } from '../fetch/addresses.js';
import type { FetchFunction, Transport } from '../fetch/guarded-fetch.js';

/** Resolves a host name to every address it has, with Node's resolver. */
export const nodeResolveHost: ResolveHost = async (hostname) => {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map((entry) => entry.address);
};

/**
 * A `lookup` for `net` and `https` that fails unless every address is public,
 * and hands back only checked addresses.
 */
export const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  const wantsAll = (options as LookupAllOptions).all === true;
  dnsLookup(
    hostname,
    { ...(options as LookupOneOptions), all: true, verbatim: true },
    (error, addresses) => {
      if (error) return callback(error, '', 0);
      const list = addresses as unknown as LookupAddress[];
      const blocked = list.find((entry) => !isPublicAddress(entry.address));
      if (blocked || list.length === 0) {
        const refusal = Object.assign(
          new Error(
            `${hostname} resolves to ${blocked?.address ?? 'nothing'}, which is not public`,
          ),
          {
            code: 'EADDRNOTPUBLIC',
          },
        );
        return callback(refusal, '', 0);
      }
      if (wantsAll)
        return (callback as unknown as (error: null, addresses: LookupAddress[]) => void)(
          null,
          list,
        );
      const first = list[0] as LookupAddress;
      return callback(null, first.address, first.family);
    },
  );
};

function toHeaders(incoming: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming)) {
    if (Array.isArray(value)) for (const item of value) headers.append(name, item);
    else if (value !== undefined) headers.set(name, value);
  }
  return headers;
}

/**
 * A GET-only `fetch` over `node:https` that connects only to public addresses
 * it checked itself. It never follows redirects and sends no cookies.
 */
export const nodePinnedFetch: FetchFunction = (input, init) =>
  new Promise<Response>((resolve, reject) => {
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const outgoing = request(
      input,
      { method: 'GET', headers, lookup: publicOnlyLookup, signal: init.signal ?? undefined },
      (incoming) => {
        const status = incoming.statusCode ?? 0;
        const body =
          status === 204 || status === 304
            ? null
            : (Readable.toWeb(incoming) as ReadableStream<Uint8Array>);
        resolve(new Response(body, { status, headers: toHeaders(incoming.headers) }));
      },
    );
    outgoing.on('error', reject);
    outgoing.end();
  });

/** Pass this as the transport for `createMetadataFetcher` and `createLogoProxy` on Node. */
export const nodeTransport: Transport = { resolveHost: nodeResolveHost, fetch: nodePinnedFetch };
