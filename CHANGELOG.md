# Changelog

## 0.1.0

The first release: a UI kit for MCP OAuth on custom MCP servers.

- **Recognise the client** (`mcp-connect-kit`): `identifyClient` names a client from its metadata document URL or redirect URI, never from its name, and reports `unknown-client`, `name-claims-known-brand`, `localhost-only` and `logo-host-differs`. Default clients: ChatGPT, Codex, Claude, Claude Code, VS Code and Gemini CLI, with Gemini CLI and the Gemini app in one `gemini` family. `unverifiedClients` adds the Gemini app and Cursor.
- **Read metadata documents**: `readClientMetadata` checks `client_id`, refuses shared secrets, and keeps only the grants the server offers.
- **Fetch safely**: `createMetadataFetcher` and the logo route `createLogoProxy` use HTTPS only, follow no redirects, and refuse private addresses, with size limits and a deadline. `mcp-connect-kit/node` pins each connection to an address it checked.
- **Screens** (`mcp-connect-kit/react`): `ConnectFrame`, `ConsentView`, `SignInHeader`, `DecisionView` and `ReturnView`, in Tailwind 4 classes (`mcp-connect-kit/tailwind.css`) or a built stylesheet (`mcp-connect-kit/react/styles.css`), with bundled marks for recognised clients.
- **Better Auth** (`mcp-connect-kit/better-auth`): `cimdOptions` for `@better-auth/cimd`, and `consentContext` for the consent page.
