# Changelog

## 0.1.0

The first release.

- **Recognise the client** (`mcp-connect-kit`): `identifyClient` names a client from its metadata document URL or redirect URI, never from its name, and reports `unknown-client`, `name-claims-known-brand`, `localhost-only` and `logo-host-differs`. Default clients: ChatGPT, Codex, Claude, Claude Code, VS Code and Gemini CLI. `unverifiedClients` adds the Gemini app and Cursor.
- **Read metadata documents**: `readClientMetadata` checks `client_id`, refuses shared secrets, and keeps only the grants the server offers.
- **Fetch safely**: `createMetadataFetcher` and the logo route `createLogoProxy` use HTTPS only, follow no redirects, and refuse private addresses, with size limits and a deadline. `mcp-connect-kit/node` pins each connection to an address it checked.
- **Screens** (`mcp-connect-kit/react`): `ConnectFrame`, `ConsentView`, `SignInHeader`, `DecisionView` and `ReturnView`, in Tailwind 4 classes (`mcp-connect-kit/tailwind.css`) or a built stylesheet (`mcp-connect-kit/react/styles.css`), with bundled marks for recognised clients.
- **Widgets** (`mcp-connect-kit/widgets`): `registerCards` lists each card's current URI and answers every earlier revision with the current HTML. `cardToolMeta` writes both the MCP Apps and the ChatGPT keys. `mcp-connect-kit/widgets/build` inlines a card into one HTML file named by its content.
- **Better Auth** (`mcp-connect-kit/better-auth`): `cimdOptions` for `@better-auth/cimd`, and `consentContext` for the consent page.
