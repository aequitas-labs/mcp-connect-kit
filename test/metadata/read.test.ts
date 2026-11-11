import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { ClientMetadataError, readClientMetadata } from '../../src/index.js';
import type { ClientMetadataPolicy } from '../../src/index.js';

const policy = (url: string): ClientMetadataPolicy => ({
  url,
  grants: ['authorization_code', 'refresh_token'],
  authMethods: ['none', 'private_key_jwt'],
});

function recorded(name: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(new URL(`../fixtures/metadata/${name}.json`, import.meta.url), 'utf8'),
  );
}

function refusal(raw: unknown, url: string): ClientMetadataError {
  try {
    readClientMetadata(raw, policy(url));
  } catch (error) {
    if (error instanceof ClientMetadataError) return error;
    throw error;
  }
  throw new Error('expected the document to be refused');
}

describe('readClientMetadata', () => {
  it('kit-recognise:ach-grant-filter — keeps only the grants the server offers', () => {
    const doc = readClientMetadata(
      recorded('chatgpt'),
      policy('https://chatgpt.com/oauth/client.json'),
    );
    expect(doc.grant_types).toEqual(['authorization_code', 'refresh_token']);
    expect(doc.token_endpoint_auth_method).toBe('private_key_jwt');
    expect(doc.jwks_uri).toBe('https://chatgpt.com/oauth/jwks.json');
    expect(doc.logo_uri).toBe('https://persistent.oaistatic.com/sonic/misc/openai-logo.png');
  });

  it("reads VS Code's document, which also lists the device code grant", () => {
    const doc = readClientMetadata(
      recorded('vscode'),
      policy('https://vscode.dev/oauth/client-metadata.json'),
    );
    expect(doc.grant_types).toEqual(['authorization_code', 'refresh_token']);
    expect(doc.application_type).toBe('native');
  });

  it('kit-recognise:pres-grant-none — refuses a document with no grant the server offers', () => {
    const raw = {
      ...recorded('codex'),
      grant_types: ['urn:ietf:params:oauth:grant-type:device_code'],
    };
    const error = refusal(raw, 'https://chatgpt.com/oauth/codex/client.json');
    expect(error.code).toBe('invalid_client_metadata');
  });

  it("kit-recognise:pres-client-id — refuses a document whose client_id isn't its URL", () => {
    const error = refusal(recorded('chatgpt'), 'https://chatgpt.com/oauth/other/client.json');
    expect(error.code).toBe('invalid_client_metadata');
    expect(error.message).toContain('differs from the document URL');
  });

  it('refuses shared secrets, which a metadata document must not carry', () => {
    const url = 'https://a.example/client.json';
    const base = { client_id: url, redirect_uris: ['https://a.example/cb'] };
    expect(refusal({ ...base, client_secret: 's3cret' }, url).message).toContain('client_secret');
    expect(
      refusal({ ...base, token_endpoint_auth_method: 'client_secret_basic' }, url).message,
    ).toContain('shared secret');
  });

  it('refuses names that could hide text, and redirects with fragments', () => {
    const url = 'https://a.example/client.json';
    expect(
      refusal(
        { client_id: url, client_name: 'Acme‮', redirect_uris: ['https://a.example/cb'] },
        url,
      ).message,
    ).toContain('hidden');
    expect(
      refusal({ client_id: url, redirect_uris: ['https://a.example/cb#x'] }, url).message,
    ).toContain('not a valid redirect');
    expect(refusal({ client_id: url, redirect_uris: [] }, url).message).toContain('redirect_uris');
  });

  it('drops a logo that is not HTTPS', () => {
    const url = 'https://a.example/client.json';
    const doc = readClientMetadata(
      {
        client_id: url,
        redirect_uris: ['https://a.example/cb'],
        logo_uri: 'http://a.example/logo.png',
      },
      policy(url),
    );
    expect(doc.logo_uri).toBeUndefined();
    expect(doc.grant_types).toEqual(['authorization_code']);
  });
});
