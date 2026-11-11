// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { defaultClients, identifyClient, unverifiedClients } from '../../src/index.js';
import type { ClientIdentity } from '../../src/index.js';
import {
  ConnectFrame,
  ConsentView,
  DecisionView,
  ReturnView,
  SignInHeader,
} from '../../src/react/index.js';

afterEach(cleanup);

const chatgptDocument = JSON.parse(
  readFileSync(join(import.meta.dirname, '../fixtures/metadata/chatgpt.json'), 'utf8'),
);
const chatgpt: ClientIdentity = identifyClient({
  clientId: 'https://chatgpt.com/oauth/client.json',
  redirectUri: 'https://chatgpt.com/connector_platform_oauth_redirect',
  metadata: chatgptDocument,
});
const claude: ClientIdentity = identifyClient({
  clientId: 'dcr_1',
  redirectUri: 'https://claude.ai/api/mcp/auth_callback',
});
const acme: ClientIdentity = identifyClient({
  clientId: 'dcr_2',
  redirectUri: 'https://acme-agent.example/cb',
  metadata: { client_name: 'Acme Agent' },
});
const fakeChatgpt: ClientIdentity = identifyClient({
  clientId: 'dcr_3',
  redirectUri: 'https://evil.example/cb',
  metadata: { client_name: 'ChatGPT' },
});
const runhome = { app: { name: 'Runhome', logo: '/runhome-logo.svg' } };
const scopes = [
  { id: 'estimates:read', label: 'See your estimates' },
  { id: 'estimates:write', label: 'Ask for a new estimate' },
];

function consent(
  client: ClientIdentity,
  extra: Partial<Parameters<typeof ConsentView>[0]> = {},
): ReturnType<typeof render> {
  return render(
    <ConnectFrame theme={runhome}>
      <ConsentView client={client} scopes={scopes} onAllow={vi.fn()} onDeny={vi.fn()} {...extra} />
    </ConnectFrame>,
  );
}

describe('ConsentView', () => {
  it('kit-screens:ach-host — names the client and app, and says where the person goes back to', () => {
    consent(chatgpt, { logoSrc: '/oauth/client-logo/abc?src=x' });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Connect ChatGPT to Runhome',
    );
    expect(screen.getByText("You'll go back to chatgpt.com.")).toBeTruthy();
    expect(screen.getByText('ChatGPT will be able to:')).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
    expect(document.querySelector('[data-mcpc-mark]')?.getAttribute('data-mcpc-mark')).toBe('logo');
  });

  it('kit-screens:ach-unknown — an unknown client is in quotes, with a neutral icon and the warning above the scope list', () => {
    consent(acme);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Connect "Acme Agent" to Runhome',
    );
    const warning = screen.getByRole('note');
    expect(warning.textContent).toBe(
      "Runhome doesn't recognise this app. Only allow it if you added it yourself.",
    );
    const scopeIntro = screen.getByText('"Acme Agent" will be able to:');
    expect(
      warning.compareDocumentPosition(scopeIntro) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(document.querySelector('[data-mcpc-mark]')?.getAttribute('data-mcpc-mark')).toBe(
      'neutral',
    );
    expect(screen.getByText("You'll go back to acme-agent.example.")).toBeTruthy();
  });

  it('kit-screens:pres-no-marks — a client known only by its name gets the neutral icon, even when the name is a brand', () => {
    consent(fakeChatgpt);
    expect(document.querySelector('[data-mcpc-mark]')?.getAttribute('data-mcpc-mark')).toBe(
      'neutral',
    );
    expect(document.querySelector('[data-mcpc-mark] svg')?.innerHTML).not.toContain('9.205 8.658');
    expect(screen.getByRole('note').textContent).toBe(
      'This app says it\'s "ChatGPT", but Runhome can\'t confirm that. Only allow it if you added it yourself.',
    );
  });

  it('shows the bundled mark for a client recognised by its redirect, and your own mark over it', () => {
    consent(claude);
    expect(document.querySelector('[data-mcpc-mark]')?.getAttribute('data-mcpc-mark')).toBe('mark');
    cleanup();
    render(
      <ConnectFrame theme={runhome} marks={{ claude: () => <i data-testid="own-mark" /> }}>
        <ConsentView client={claude} scopes={scopes} onAllow={vi.fn()} onDeny={vi.fn()} />
      </ConnectFrame>,
    );
    expect(screen.getByTestId('own-mark')).toBeTruthy();
    cleanup();
    render(
      <ConnectFrame theme={runhome} marks={false}>
        <ConsentView client={claude} scopes={scopes} onAllow={vi.fn()} onDeny={vi.fn()} />
      </ConnectFrame>,
    );
    expect(document.querySelector('[data-mcpc-mark]')?.getAttribute('data-mcpc-mark')).toBe(
      'neutral',
    );
  });

  it('shows the Gemini mark for the Gemini family, and the plug for a Gemini CLI known only by name', () => {
    const geminiApp = identifyClient({
      clientId: 'gemini_1',
      redirectUri:
        'https://oauth-redirect.googleusercontent.com/r/user_bound_custom-mcp-1-api_runhome_example',
      clients: [...defaultClients, ...unverifiedClients],
    });
    consent(geminiApp);
    expect(document.querySelector('[data-mcpc-mark]')?.getAttribute('data-mcpc-mark')).toBe('mark');
    expect(document.querySelector('[data-mcpc-mark] svg')?.innerHTML).toContain('mcpc-gemini-');
    cleanup();
    const geminiCli = identifyClient({
      clientId: 'dcr',
      redirectUri: 'http://127.0.0.1:5000/cb',
      metadata: { client_name: 'Gemini CLI MCP Client' },
    });
    consent(geminiCli);
    expect(document.querySelector('[data-mcpc-mark]')?.getAttribute('data-mcpc-mark')).toBe(
      'neutral',
    );
  });

  it('warns about a client on this computer with one line', () => {
    const local = identifyClient({
      clientId: 'dcr',
      redirectUri: 'http://127.0.0.1:5000/cb',
      metadata: { client_name: 'Gemini CLI MCP Client' },
    });
    consent(local);
    expect(screen.getAllByRole('note').map((note) => note.textContent)).toEqual([
      'This app runs on your computer. Only allow it if you started it.',
    ]);
    expect(screen.getByText("You'll go back to an app on your computer.")).toBeTruthy();
  });

  it('calls onAllow and onDeny, and disables both while busy', () => {
    const onAllow = vi.fn();
    const onDeny = vi.fn();
    const { rerender } = render(
      <ConnectFrame theme={runhome}>
        <ConsentView client={chatgpt} scopes={scopes} onAllow={onAllow} onDeny={onDeny} />
      </ConnectFrame>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Allow access' }));
    fireEvent.click(screen.getByRole('button', { name: "Don't allow" }));
    expect(onAllow).toHaveBeenCalledOnce();
    expect(onDeny).toHaveBeenCalledOnce();
    rerender(
      <ConnectFrame theme={runhome}>
        <ConsentView client={chatgpt} scopes={scopes} onAllow={onAllow} onDeny={onDeny} busy />
      </ConnectFrame>,
    );
    expect(
      (screen.getByRole('button', { name: 'Allow access' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('kit-screens:ach-theme — the theme sets the accent the Allow button uses, and the header shows your logo', () => {
    render(
      <ConnectFrame theme={{ ...runhome, color: { accent: '#0b6' } }}>
        <ConsentView client={chatgpt} scopes={scopes} onAllow={vi.fn()} onDeny={vi.fn()} />
      </ConnectFrame>,
    );
    const frame = document.querySelector('.mcpc') as HTMLElement;
    expect(frame.style.getPropertyValue('--mcpc-light-accent')).toBe('#0b6');
    expect(screen.getByRole('button', { name: 'Allow access' }).className).toContain(
      'bg-mcpc-accent',
    );
    expect(screen.getByRole('img', { name: 'Runhome' }).getAttribute('src')).toBe(
      '/runhome-logo.svg',
    );
  });

  it('takes copy overrides', () => {
    consent(chatgpt, {
      copy: { allow: 'Connect', returnLine: (host) => `Back to ${host} after this.` },
    });
    expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy();
    expect(screen.getByText('Back to chatgpt.com after this.')).toBeTruthy();
  });
});

describe('where the person goes back to', () => {
  it('names an app that opens through its own URL scheme in words, not by its scheme host', () => {
    const cursor = identifyClient({
      clientId: 'dcr',
      redirectUri: 'cursor://anysphere.cursor-mcp/oauth/callback',
      clients: unverifiedClients,
    });
    consent(cursor);
    expect(screen.getByText("You'll go back to an app on this device.")).toBeTruthy();
  });
});

describe('the other screens', () => {
  it('SignInHeader names the client', () => {
    render(
      <ConnectFrame theme={runhome}>
        <SignInHeader client={chatgpt} />
      </ConnectFrame>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Sign in to connect ChatGPT',
    );
  });

  it('DecisionView says what happened, in plain words', () => {
    const outcomes: Record<'allowed' | 'denied' | 'failed', string> = {
      allowed: 'ChatGPT is connected. Taking you back to chatgpt.com…',
      denied: "ChatGPT wasn't connected. You can close this page.",
      failed: "We couldn't connect ChatGPT. Go back to ChatGPT and try again.",
    };
    for (const [outcome, text] of Object.entries(outcomes) as [
      'allowed' | 'denied' | 'failed',
      string,
    ][]) {
      render(
        <ConnectFrame theme={runhome}>
          <DecisionView client={chatgpt} outcome={outcome} />
        </ConnectFrame>,
      );
      expect(screen.getByRole('status').textContent).toBe(text);
      cleanup();
    }
  });

  it('ReturnView links back for browsers that block the automatic return', () => {
    render(
      <ConnectFrame theme={runhome}>
        <ReturnView
          client={chatgpt}
          returnUrl="https://chatgpt.com/connector_platform_oauth_redirect?code=abc"
        />
      </ConnectFrame>,
    );
    expect(screen.getByRole('link', { name: 'Go back to ChatGPT' }).getAttribute('href')).toContain(
      'code=abc',
    );
  });
});
