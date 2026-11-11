import { defineClient } from './define.js';
import type { KnownClient } from './types.js';

const OPENAI_BRAND: readonly string[] = ['chatgpt', 'openai', 'codex'];
const ANTHROPIC_BRAND: readonly string[] = ['claude', 'anthropic'];

/** ChatGPT's connectors. Checked against its live metadata document on 10 Nov 2026. */
export const chatgpt: KnownClient = defineClient({
  id: 'chatgpt',
  name: 'ChatGPT',
  metadataUrls: [
    'https://chatgpt.com/oauth/client.json',
    'https://chatgpt.com/oauth/{id}/client.json',
  ],
  redirects: [
    { host: 'chatgpt.com', path: '/connector_platform_oauth_redirect', match: 'exact' },
    { host: 'chatgpt.com', path: '/connector/oauth/', match: 'prefix' },
  ],
  logoHosts: ['persistent.oaistatic.com'],
  brandNames: OPENAI_BRAND,
});

/** OpenAI's Codex, a native app with a loopback redirect, so only its document names it. */
export const codex: KnownClient = defineClient({
  id: 'codex',
  name: 'Codex',
  metadataUrls: [
    'https://chatgpt.com/oauth/codex/client.json',
    'https://chatgpt.com/oauth/codex/{id}/client.json',
  ],
  logoHosts: ['persistent.oaistatic.com'],
  brandNames: OPENAI_BRAND,
});

/** Claude on the web, desktop and phone. Its document URL isn't published, so its callback names it. */
export const claude: KnownClient = defineClient({
  id: 'claude',
  name: 'Claude',
  redirects: [
    { host: 'claude.ai', path: '/api/mcp/auth_callback', match: 'exact' },
    { host: 'claude.com', path: '/api/mcp/auth_callback', match: 'exact' },
  ],
  brandNames: ANTHROPIC_BRAND,
});

/** Claude Code, a native app with a loopback redirect, so only its document names it. */
export const claudeCode: KnownClient = defineClient({
  id: 'claude-code',
  name: 'Claude Code',
  metadataUrls: ['https://claude.ai/oauth/claude-code-client-metadata'],
  brandNames: ANTHROPIC_BRAND,
});

/** VS Code and VS Code Insiders, including GitHub Copilot's MCP connections. */
export const vscode: KnownClient = defineClient({
  id: 'vscode',
  name: 'VS Code',
  metadataUrls: [
    'https://vscode.dev/oauth/client-metadata.json',
    'https://insiders.vscode.dev/oauth/client-metadata.json',
  ],
  redirects: [
    { host: 'vscode.dev', path: '/redirect', match: 'exact' },
    { host: 'insiders.vscode.dev', path: '/redirect', match: 'exact' },
  ],
  logoHosts: ['code.visualstudio.com'],
  brandNames: ['vscode', 'visualstudiocode', 'copilot'],
});

const GEMINI_BRAND: readonly string[] = ['gemini', 'google'];

/**
 * Gemini CLI, part of the Gemini family with the Gemini app. It registers
 * dynamically with a random localhost port, so nothing proves who it is: it
 * stays unrecognised, and its own name doesn't count as claiming Google's brand.
 */
export const geminiCli: KnownClient = defineClient({
  id: 'gemini-cli',
  name: 'Gemini CLI',
  family: 'gemini',
  selfNames: ['Gemini CLI MCP Client'],
  brandNames: GEMINI_BRAND,
});

/**
 * The clients the kit knows out of the box. Each entry matches only facts
 * checked against the product itself. Add your own with `defineClient`.
 */
export const defaultClients: readonly KnownClient[] = [
  chatgpt,
  codex,
  claude,
  claudeCode,
  vscode,
  geminiCli,
];

/**
 * The Gemini app's custom connectors. Taken from one walkthrough, where the
 * person pastes a client ID and secret and registers this Google callback. Not
 * yet checked in a real sign-in, so it isn't in `defaultClients`.
 */
export const geminiApp: KnownClient = defineClient({
  id: 'gemini-app',
  name: 'Gemini',
  family: 'gemini',
  redirects: [
    {
      host: 'oauth-redirect.googleusercontent.com',
      path: '/r/user_bound_custom-mcp-',
      match: 'prefix',
    },
  ],
  brandNames: GEMINI_BRAND,
});

/**
 * Cursor, which returns through its own URL scheme. Taken from forum reports,
 * not yet checked in a real sign-in, so it isn't in `defaultClients`. Another
 * app on the same computer could register the same scheme.
 */
export const cursor: KnownClient = defineClient({
  id: 'cursor',
  name: 'Cursor',
  redirects: [
    { scheme: 'cursor:', host: 'anysphere.cursor-mcp', path: '/oauth/callback', match: 'exact' },
  ],
  brandNames: ['cursor', 'anysphere'],
});

/**
 * Clients the plan names whose rules still need a real sign-in to confirm.
 * Opt in with `[...defaultClients, ...unverifiedClients]`.
 */
export const unverifiedClients: readonly KnownClient[] = [geminiApp, cursor];
