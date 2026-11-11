import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  createMetadataFetcher,
  FetchRefusedError,
  isPublicAddress,
  readClientMetadata,
} from '../../src/index.js';
import { answering, hanging, publicResolver, unsizedBody } from '../support/fake-fetch.js';

const CHATGPT_URL = 'https://chatgpt.com/oauth/client.json';
const chatgptDocument = readFileSync(
  new URL('../fixtures/metadata/chatgpt.json', import.meta.url),
  'utf8',
);
const json = (body: BodyInit | null, init: ResponseInit = {}): Response =>
  new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    ...init,
  });

async function refusalOf(promise: Promise<unknown>): Promise<FetchRefusedError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  if (error instanceof FetchRefusedError) return error;
  throw new Error(`expected a FetchRefusedError, got ${String(error)}`);
}

describe('createMetadataFetcher', () => {
  it('fetches and parses a document, which readClientMetadata then accepts', async () => {
    const fetchMock = answering(() => json(chatgptDocument));
    const fetcher = createMetadataFetcher({ resolveHost: publicResolver, fetch: fetchMock });
    const raw = await fetcher(CHATGPT_URL);
    const document = readClientMetadata(raw, {
      url: CHATGPT_URL,
      grants: ['authorization_code', 'refresh_token'],
      authMethods: ['none', 'private_key_jwt'],
    });
    expect(document.client_name).toBe('ChatGPT');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init).toMatchObject({ method: 'GET', redirect: 'manual', credentials: 'omit' });
  });

  it('kit-fetch:ach-private-ip — refuses a host that resolves to a private address, without connecting', async () => {
    for (const addresses of [
      ['10.0.0.5'],
      ['127.0.0.1'],
      ['169.254.169.254'],
      ['93.184.215.14', '192.168.1.1'],
      ['::1'],
      ['fd00::1'],
      ['::ffff:10.0.0.1'],
      ['100.64.0.1'],
    ]) {
      const fetchMock = answering(() => json(chatgptDocument));
      const fetcher = createMetadataFetcher({
        resolveHost: async () => addresses,
        fetch: fetchMock,
      });
      const error = await refusalOf(fetcher(CHATGPT_URL));
      expect(error.reason, addresses.join()).toBe('private-address');
      expect(fetchMock, addresses.join()).not.toHaveBeenCalled();
    }
  });

  it('refuses private IP literals and loopback names even with no resolver', async () => {
    for (const url of [
      'https://10.1.2.3/client.json',
      'https://[::1]/client.json',
      'https://169.254.169.254/latest/meta-data',
      'https://localhost/client.json',
      'https://app.localhost/client.json',
    ]) {
      const fetchMock = answering(() => json(chatgptDocument));
      const error = await refusalOf(createMetadataFetcher({ fetch: fetchMock })(url));
      expect(error.reason, url).toBe('private-address');
      expect(fetchMock, url).not.toHaveBeenCalled();
    }
  });

  it('kit-fetch:ach-no-redirect — refuses a 3xx and never requests the Location URL', async () => {
    const fetchMock = answering(
      () => new Response(null, { status: 302, headers: { location: 'https://169.254.169.254/' } }),
    );
    const error = await refusalOf(
      createMetadataFetcher({ resolveHost: publicResolver, fetch: fetchMock })(CHATGPT_URL),
    );
    expect(error.reason).toBe('redirect');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(CHATGPT_URL);
  });

  it('kit-fetch:ach-size — refuses a document over 5 KB, declared or streamed', async () => {
    const declared = answering(() =>
      json('{}', { headers: { 'content-type': 'application/json', 'content-length': '5121' } }),
    );
    expect(
      (
        await refusalOf(
          createMetadataFetcher({ resolveHost: publicResolver, fetch: declared })(CHATGPT_URL),
        )
      ).reason,
    ).toBe('too-large');
    const streamed = answering(() => json(unsizedBody(5121)));
    expect(
      (
        await refusalOf(
          createMetadataFetcher({ resolveHost: publicResolver, fetch: streamed })(CHATGPT_URL),
        )
      ).reason,
    ).toBe('too-large');
    const atLimit = answering(() => json(`"${' '.repeat(5118)}"`));
    await expect(
      createMetadataFetcher({ resolveHost: publicResolver, fetch: atLimit })(CHATGPT_URL),
    ).resolves.toBeTypeOf('string');
  });

  it('accepts only a 200 JSON answer over HTTPS', async () => {
    const fetcherFor = (response: () => Response) =>
      createMetadataFetcher({ resolveHost: publicResolver, fetch: answering(response) });
    expect(
      (await refusalOf(fetcherFor(() => json(chatgptDocument, { status: 203 }))(CHATGPT_URL)))
        .reason,
    ).toBe('bad-status');
    expect(
      (
        await refusalOf(
          fetcherFor(() => new Response('<html>', { headers: { 'content-type': 'text/html' } }))(
            CHATGPT_URL,
          ),
        )
      ).reason,
    ).toBe('bad-content-type');
    expect((await refusalOf(fetcherFor(() => json('{nope'))(CHATGPT_URL))).reason).toBe(
      'invalid-json',
    );
    expect(
      (
        await refusalOf(
          fetcherFor(() => json(chatgptDocument))('http://chatgpt.com/oauth/client.json'),
        )
      ).reason,
    ).toBe('not-https');
  });

  it('gives up after the deadline', async () => {
    const error = await refusalOf(
      createMetadataFetcher({ resolveHost: publicResolver, fetch: hanging(), timeoutMs: 20 })(
        CHATGPT_URL,
      ),
    );
    expect(error.reason).toBe('timeout');
  });
});

describe('isPublicAddress', () => {
  it('accepts public unicast and refuses special-use ranges', () => {
    expect(isPublicAddress('93.184.215.14')).toBe(true);
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
    for (const address of [
      '0.0.0.0',
      '10.0.0.1',
      '172.16.0.1',
      '192.168.0.1',
      '127.0.0.1',
      '169.254.1.1',
      '100.64.0.1',
      '224.0.0.1',
      '255.255.255.255',
      '192.0.2.1',
      '::',
      '::1',
      'fe80::1',
      'fc00::1',
      '::ffff:127.0.0.1',
      '2002:7f00:1::',
      '64:ff9b::a00:1',
      'not an ip',
    ]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });
});
