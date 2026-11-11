import { createServer } from 'node:net';
import type { AddressInfo, Server } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import { createMetadataFetcher, FetchRefusedError } from '../../src/index.js';
import {
  nodePinnedFetch,
  nodeResolveHost,
  nodeTransport,
  publicOnlyLookup,
} from '../../src/node/index.js';

let server: Server | undefined;
afterEach(() => server?.close());

describe('mcp-connect-kit/node', () => {
  it('resolves localhost to a loopback address, which the fetcher then refuses', async () => {
    expect((await nodeResolveHost('localhost')).length).toBeGreaterThan(0);
    const error = await createMetadataFetcher(nodeTransport)('https://localhost/client.json').catch(
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(FetchRefusedError);
  });

  it('kit-fetch:ach-private-ip — the pinned fetch refuses a private address at connect time, so no connection opens', async () => {
    let connections = 0;
    server = createServer(() => {
      connections += 1;
    });
    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    // A name, not a literal, so the request goes through the lookup the way a rebinding host would.
    const error = await nodePinnedFetch(new URL(`https://localhost:${port}/client.json`), {
      headers: {},
    }).catch((reason: unknown) => reason);
    expect((error as { code?: string }).code).toBe('EADDRNOTPUBLIC');
    expect(connections).toBe(0);
  });

  it('the lookup hands back addresses only when all of them are public', async () => {
    const result = await new Promise<{ error: NodeJS.ErrnoException | null }>((resolve) =>
      publicOnlyLookup('localhost', {}, (error) => resolve({ error })),
    );
    expect(result.error?.code).toBe('EADDRNOTPUBLIC');
  });
});
