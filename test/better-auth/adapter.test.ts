import type { CimdOptions } from '@better-auth/cimd';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { FetchRefusedError } from '../../src/index.js';
import { cimdOptions, consentContext } from '../../src/better-auth/index.js';
import { answering, publicResolver } from '../support/fake-fetch.js';

const CHATGPT_URL = 'https://chatgpt.com/oauth/client.json';
const chatgptDocument = readFileSync(
  new URL('../fixtures/metadata/chatgpt.json', import.meta.url),
  'utf8',
);
const json = (body: string): Response =>
  new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });

describe('cimdOptions', () => {
  it("fits @better-auth/cimd's options", () => {
    const options: Pick<CimdOptions, 'fetchClientMetadataResource' | 'metadataProfile'> =
      cimdOptions({ grants: ['authorization_code'] });
    expect(options.metadataProfile).toBe('mcp-2026-07-28');
  });

  it("cuts a document's grants to the ones the server offers, before Better Auth checks them", async () => {
    const fetchMock = answering(() => json(chatgptDocument));
    const { fetchClientMetadataResource } = cimdOptions({
      resolveHost: publicResolver,
      fetch: fetchMock,
      grants: ['authorization_code', 'refresh_token'],
    });
    const response = await fetchClientMetadataResource(CHATGPT_URL, {
      headers: { accept: 'application/json' },
    });
    expect((await response.json()).grant_types).toEqual(['authorization_code', 'refresh_token']);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual', credentials: 'omit' });
  });

  it('passes other resources, such as a JWKS, through untouched', async () => {
    const jwks = '{"keys":[{"kty":"RSA","kid":"a"}]}';
    const { fetchClientMetadataResource } = cimdOptions({
      resolveHost: publicResolver,
      fetch: answering(() => json(jwks)),
      grants: ['authorization_code'],
    });
    expect(
      await (
        await fetchClientMetadataResource(new URL('https://chatgpt.com/oauth/jwks.json'))
      ).text(),
    ).toBe(jwks);
  });

  it('refuses a private address without fetching', async () => {
    const fetchMock = answering(() => json(chatgptDocument));
    const { fetchClientMetadataResource } = cimdOptions({
      resolveHost: async () => ['10.0.0.1'],
      fetch: fetchMock,
      grants: ['authorization_code'],
    });
    await expect(fetchClientMetadataResource(CHATGPT_URL)).rejects.toBeInstanceOf(
      FetchRefusedError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('consentContext', () => {
  it('names a discovered client from its document URL, with its logo through the route', async () => {
    const context = await consentContext({
      client: {
        clientId: CHATGPT_URL,
        clientDiscoveryId: 'cimd',
        name: 'ChatGPT',
        icon: 'https://persistent.oaistatic.com/sonic/misc/openai-logo.png',
        redirectUris: ['https://chatgpt.com/connector_platform_oauth_redirect'],
      },
      redirectUri: 'https://chatgpt.com/connector_platform_oauth_redirect',
    });
    expect(context.client).toMatchObject({ id: 'chatgpt', via: 'metadata-url', logo: 'metadata' });
    expect(context.logoSrc).toMatch(/^\/oauth\/client-logo\/[0-9a-f]{32}\?src=/);
  });

  it('never treats a dynamically registered client ID as a document URL', async () => {
    const context = await consentContext({
      client: { clientId: CHATGPT_URL, name: 'ChatGPT', redirectUris: ['https://evil.example/cb'] },
      redirectUri: 'https://evil.example/cb',
    });
    expect(context.client.id).toBeNull();
    expect(context.client.warnings).toContain('name-claims-known-brand');
    expect(context.logoSrc).toBeUndefined();
  });
});
