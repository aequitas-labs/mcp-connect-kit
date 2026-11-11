// A consent screen for the browser checks and screenshots, picked by query string:
// ?client=chatgpt|claude|unknown|spoof|local&scheme=light|dark&theme=default|green
import { createRoot } from 'react-dom/client';

import { identifyClient } from '../src/index.js';
import type { ClientIdentity } from '../src/index.js';
import { ConnectFrame, ConsentView } from '../src/react/index.js';
import type { ConnectTheme } from '../src/react/index.js';

const clients: Record<string, ClientIdentity> = {
  chatgpt: identifyClient({
    clientId: 'dcr_1',
    redirectUri: 'https://chatgpt.com/connector_platform_oauth_redirect',
  }),
  claude: identifyClient({
    clientId: 'dcr_2',
    redirectUri: 'https://claude.ai/api/mcp/auth_callback',
  }),
  unknown: identifyClient({
    clientId: 'dcr_3',
    redirectUri: 'https://acme-agent.example/cb',
    metadata: { client_name: 'Acme Agent' },
  }),
  spoof: identifyClient({
    clientId: 'dcr_4',
    redirectUri: 'https://evil.example/cb',
    metadata: { client_name: 'ChatGPT' },
  }),
  local: identifyClient({
    clientId: 'dcr_5',
    redirectUri: 'http://127.0.0.1:53682/callback',
    metadata: { client_name: 'Gemini CLI MCP Client' },
  }),
};

const appLogo =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="32" viewBox="0 0 120 32"><rect width="32" height="32" rx="8" fill="#0f3d2e"/><text x="40" y="22" font-family="system-ui" font-size="18" font-weight="600" fill="#0f3d2e">Runhome</text></svg>',
  );

const appIcon =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0f3d2e"/><path d="M9 17l7-6 7 6v7H9z" fill="#fff"/></svg>',
  );

const params = new URLSearchParams(location.search);
const client = clients[params.get('client') ?? 'chatgpt'] ?? clients.chatgpt;
const scheme = params.get('scheme') === 'dark' ? 'dark' : 'light';
const theme: ConnectTheme = {
  app: { name: 'Runhome', logo: appLogo, icon: appIcon },
  ...(params.get('theme') === 'green' ? { color: { accent: '#0b6' } } : {}),
};

createRoot(document.getElementById('root') as HTMLElement).render(
  <ConnectFrame theme={theme} colorScheme={scheme}>
    <ConsentView
      client={client as ClientIdentity}
      scopes={[
        { id: 'estimates:read', label: 'See your estimates' },
        { id: 'estimates:write', label: 'Ask for a new estimate' },
      ]}
      onAllow={() => undefined}
      onDeny={() => undefined}
    />
  </ConnectFrame>,
);
