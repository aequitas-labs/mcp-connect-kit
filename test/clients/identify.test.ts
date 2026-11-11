import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  defaultClients,
  defineClient,
  identifyClient,
  KnownClientError,
  loopbackRedirectMatcher,
  unverifiedClients,
} from '../../src/index.js';

function recorded(name: string): {
  client_id: string;
  client_name?: string;
  redirect_uris: string[];
  logo_uri?: string;
} {
  return JSON.parse(
    readFileSync(new URL(`../fixtures/metadata/${name}.json`, import.meta.url), 'utf8'),
  );
}

describe('identifyClient', () => {
  it('kit-recognise:ach-cimd-chatgpt — names ChatGPT from its metadata URL', () => {
    const metadata = recorded('chatgpt');
    const identity = identifyClient({
      clientId: 'https://chatgpt.com/oauth/client.json',
      redirectUri: 'https://chatgpt.com/connector_platform_oauth_redirect',
      metadata,
    });
    expect(identity.id).toBe('chatgpt');
    expect(identity.via).toBe('metadata-url');
    expect(identity.name).toBe('ChatGPT');
    expect(identity.returnHost).toBe('chatgpt.com');
    expect(identity.logo).toBe('metadata');
    expect(identity.logoUri).toBe('https://persistent.oaistatic.com/sonic/misc/openai-logo.png');
    expect(identity.warnings).toEqual([]);
  });

  it('kit-recognise:ach-name-spoof — a client that only claims the name stays unknown and is flagged', () => {
    const identity = identifyClient({
      clientId: 'dcr_8f2c',
      redirectUri: 'https://evil.example/cb',
      metadata: { client_name: 'ChatGPT', redirect_uris: ['https://evil.example/cb'] },
    });
    expect(identity.id).toBeNull();
    expect(identity.via).toBe('none');
    expect(identity.name).toBe('ChatGPT');
    expect(identity.logo).toBe('none');
    expect(identity.warnings).toContain('unknown-client');
    expect(identity.warnings).toContain('name-claims-known-brand');
  });

  it('flags brand names hidden by spacing, case and punctuation', () => {
    for (const name of ['chat-gpt helper', 'Claude Desktop', 'Open AI Agent', 'VS-Code Sync']) {
      const identity = identifyClient({
        clientId: 'x',
        redirectUri: 'https://a.example/cb',
        metadata: { client_name: name },
      });
      expect(identity.warnings, name).toContain('name-claims-known-brand');
    }
  });

  it('kit-recognise:ach-loopback — a client that only returns to this computer gets localhost-only', () => {
    const identity = identifyClient({
      clientId: 'dcr_1',
      redirectUri: 'http://127.0.0.1:53682/callback',
      metadata: {
        client_name: 'Gemini CLI MCP Client',
        redirect_uris: ['http://localhost:53682/callback'],
      },
    });
    expect(identity.warnings).toContain('localhost-only');
    // Gemini CLI's own name is not a claim on Google's brand.
    expect(identity.warnings).not.toContain('name-claims-known-brand');
    expect(identity.name).toBe('Gemini CLI MCP Client');
    expect(identity.id).toBeNull();
  });

  it('keeps localhost-only for a known native app, because any local program can reuse its client ID', () => {
    const metadata = recorded('claude-code');
    const identity = identifyClient({
      clientId: metadata.client_id,
      redirectUri: 'http://localhost:61234/callback',
      metadata,
    });
    expect(identity.id).toBe('claude-code');
    expect(identity.warnings).toEqual(['localhost-only']);
  });

  it('recognises every recorded vendor document by its URL', () => {
    const expected: Record<string, string> = {
      chatgpt: 'chatgpt',
      codex: 'codex',
      'claude-code': 'claude-code',
      vscode: 'vscode',
    };
    for (const [fixture, id] of Object.entries(expected)) {
      const metadata = recorded(fixture);
      const identity = identifyClient({
        clientId: metadata.client_id,
        redirectUri: metadata.redirect_uris[0] ?? '',
        metadata,
      });
      expect(identity.id, fixture).toBe(id);
      expect(identity.via, fixture).toBe('metadata-url');
    }
  });

  it('prefers an exact metadata URL over a pattern, so Codex never reads as ChatGPT', () => {
    expect(
      identifyClient({
        clientId: 'https://chatgpt.com/oauth/codex/client.json',
        redirectUri: 'http://127.0.0.1/callback',
      }).id,
    ).toBe('codex');
    expect(
      identifyClient({
        clientId: 'https://chatgpt.com/oauth/app-123/client.json',
        redirectUri: 'https://chatgpt.com/connector/oauth/abc',
      }).id,
    ).toBe('chatgpt');
  });

  it('recognises Claude on the web by its callback', () => {
    const identity = identifyClient({
      clientId: 'dcr_claude',
      redirectUri: 'https://claude.ai/api/mcp/auth_callback',
      metadata: { client_name: 'claudeai' },
    });
    expect(identity).toMatchObject({
      id: 'claude',
      name: 'Claude',
      via: 'redirect',
      logo: 'mark',
      returnHost: 'claude.ai',
    });
  });

  it('refuses a callback on the right host but a different path, port or scheme', () => {
    for (const redirectUri of [
      'https://claude.ai/api/mcp/auth_callback/extra',
      'https://claude.ai:8443/api/mcp/auth_callback',
      'http://claude.ai/api/mcp/auth_callback',
      'https://claude.ai.evil.example/api/mcp/auth_callback',
    ]) {
      expect(identifyClient({ clientId: 'x', redirectUri }).id, redirectUri).toBeNull();
    }
  });

  it('shows the mark, not the document logo, when the logo is on a host the entry does not list', () => {
    const identity = identifyClient({
      clientId: 'https://chatgpt.com/oauth/client.json',
      redirectUri: 'https://chatgpt.com/connector_platform_oauth_redirect',
      metadata: { ...recorded('chatgpt'), logo_uri: 'https://tracker.example/pixel.png' },
    });
    expect(identity.logo).toBe('mark');
    expect(identity.logoUri).toBeNull();
    expect(identity.warnings).toContain('logo-host-differs');
  });

  it('strips characters that could hide or reorder a name', () => {
    const identity = identifyClient({
      clientId: 'x',
      redirectUri: 'https://a.example/cb',
      metadata: { client_name: 'Acme‮evil\u0000' },
    });
    expect(identity.name).toBe('Acmeevil');
  });

  it('falls back to the return host when an unknown client sends no name', () => {
    expect(identifyClient({ clientId: 'x', redirectUri: 'https://agent.example/cb' }).name).toBe(
      'agent.example',
    );
  });

  it('leaves the unverified Gemini app and Cursor rules out of the defaults', () => {
    const gemini = {
      clientId: 'x',
      redirectUri:
        'https://oauth-redirect.googleusercontent.com/r/user_bound_custom-mcp-123-api_example_com',
    };
    expect(identifyClient(gemini).id).toBeNull();
    expect(
      identifyClient({ ...gemini, clients: [...defaultClients, ...unverifiedClients] }).id,
    ).toBe('gemini-app');
    const cursorRedirect = {
      clientId: 'x',
      redirectUri: 'cursor://anysphere.cursor-mcp/oauth/callback',
    };
    expect(identifyClient({ ...cursorRedirect, clients: unverifiedClients }).id).toBe('cursor');
  });
});

describe('the Gemini family', () => {
  it('maps Gemini CLI and the Gemini app to the same family, so they share a name family and mark', () => {
    const geminiApp = identifyClient({
      clientId: 'x',
      redirectUri:
        'https://oauth-redirect.googleusercontent.com/r/user_bound_custom-mcp-1-api_example_com',
      clients: [...defaultClients, ...unverifiedClients],
    });
    expect(geminiApp).toMatchObject({ id: 'gemini-app', name: 'Gemini', family: 'gemini' });
    expect(defaultClients.find((client) => client.id === 'gemini-cli')?.family).toBe('gemini');
  });

  it("still gives a Gemini CLI that is known only by name no family, so it can't earn the mark", () => {
    const identity = identifyClient({
      clientId: 'dcr_1',
      redirectUri: 'http://127.0.0.1:53682/callback',
      metadata: { client_name: 'Gemini CLI MCP Client' },
    });
    expect(identity).toMatchObject({ id: null, family: null, via: 'none' });
  });

  it('defaults a family to the client id', () => {
    const identity = identifyClient({
      clientId: 'https://chatgpt.com/oauth/client.json',
      redirectUri: 'https://chatgpt.com/connector_platform_oauth_redirect',
    });
    expect(identity.family).toBe('chatgpt');
  });
});

describe('defineClient', () => {
  it('accepts an app-specific client', () => {
    const acme = defineClient({
      id: 'acme',
      name: 'Acme',
      redirects: [{ host: 'acme.dev', path: '/cb', match: 'exact' }],
    });
    expect(
      identifyClient({ clientId: 'x', redirectUri: 'https://acme.dev/cb', clients: [acme] }).name,
    ).toBe('Acme');
  });

  it('refuses rules that prove nothing', () => {
    expect(() =>
      defineClient({
        id: 'a',
        name: 'A',
        redirects: [{ host: 'localhost', path: '/cb', match: 'exact' }],
      }),
    ).toThrow(KnownClientError);
    expect(() =>
      defineClient({
        id: 'a',
        name: 'A',
        redirects: [{ scheme: 'http:', host: 'a.example', path: '/cb', match: 'exact' }],
      }),
    ).toThrow(KnownClientError);
    expect(() =>
      defineClient({ id: 'a', name: 'A', metadataUrls: ['http://a.example/client.json'] }),
    ).toThrow(KnownClientError);
    expect(() =>
      defineClient({ id: 'a', name: 'A', metadataUrls: ['https://{id}.example/client.json'] }),
    ).toThrow(KnownClientError);
    expect(() =>
      defineClient({ id: 'A B', name: 'A', metadataUrls: ['https://a.example/c.json'] }),
    ).toThrow(KnownClientError);
    expect(() => defineClient({ id: 'a', name: 'A' })).toThrow(KnownClientError);
  });
});

describe('loopbackRedirectMatcher', () => {
  it('ignores the port on a loopback redirect, as RFC 8252 asks', () => {
    expect(
      loopbackRedirectMatcher('http://127.0.0.1/callback', 'http://127.0.0.1:53682/callback'),
    ).toBe(true);
  });

  it('still compares host, path and scheme', () => {
    expect(
      loopbackRedirectMatcher('http://127.0.0.1/callback', 'http://localhost:53682/callback'),
    ).toBe(false);
    expect(
      loopbackRedirectMatcher('http://127.0.0.1/callback', 'http://127.0.0.1:53682/other'),
    ).toBe(false);
    expect(
      loopbackRedirectMatcher('https://app.example/callback', 'https://app.example:444/callback'),
    ).toBe(false);
  });
});
