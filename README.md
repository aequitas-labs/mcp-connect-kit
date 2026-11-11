# mcp-connect-kit

Shared pieces for MCP servers that people connect to from ChatGPT, Claude, VS Code and other clients:

- **Recognise the client** from facts the server can check (its metadata document URL or its redirect URI), never from the name it sends.
- **Fetch client metadata documents and logos safely**, without reaching private addresses.
- **Sign-in and consent screens** in React and Tailwind, which name the client, say where the person goes back to, and warn about apps the server can't confirm.
- **Widget helpers** for MCP Apps and ChatGPT, where older template URIs keep working after a deploy.

The package is being built in small steps. It isn't on npm yet.

## Recognise the client

```ts
import { identifyClient, readClientMetadata } from 'mcp-connect-kit';

const client = identifyClient({
  clientId, // a metadata document URL (CIMD) or an opaque id (DCR)
  redirectUri, // the redirect of this authorization request
  metadata, // the stored metadata document or registration
});
// { id: 'chatgpt', name: 'ChatGPT', via: 'metadata-url', returnHost: 'chatgpt.com',
//   logo: 'metadata', logoUri: 'https://persistent.oaistatic.com/…', warnings: [] }
```

The kit decides who a client is from facts the server can check, strongest first:

1. **The metadata document URL.** For a client ID metadata document, the client ID is an HTTPS URL that only the product can publish at. Pass a client ID only after the server has fetched that URL and checked that the document's `client_id` equals it.
2. **The redirect URI.** An HTTPS callback the product controls, such as `https://claude.ai/api/mcp/auth_callback`, proves the authorization code reaches that product. Loopback redirects (`127.0.0.1`, `localhost`) prove nothing, because any program on the computer can listen there.
3. **The name.** Whatever the client sent. It is shown in quotes and never earns a product's name or logo.

`warnings` lists what the person should know before allowing the client:

| Warning                   | When                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `unknown-client`          | No metadata URL or redirect matched a known client.                                                                                  |
| `name-claims-known-brand` | An unknown client's name contains a known product's name, such as "ChatGPT Helper".                                                  |
| `localhost-only`          | The person goes back to an address on their own computer. Known native apps get it too, since any program can reuse their client ID. |
| `logo-host-differs`       | A known client's document points its logo at a host its entry doesn't list. The kit shows its mark instead.                          |

### The clients it knows

| Client      | Known by                                                                                            | Logo in its document          |
| ----------- | --------------------------------------------------------------------------------------------------- | ----------------------------- |
| ChatGPT     | `https://chatgpt.com/oauth/client.json` (and `/oauth/{id}/client.json`), or its connector callbacks | on `persistent.oaistatic.com` |
| Codex       | `https://chatgpt.com/oauth/codex/client.json`                                                       | on `persistent.oaistatic.com` |
| Claude      | the callback `https://claude.ai/api/mcp/auth_callback`                                              | none                          |
| Claude Code | `https://claude.ai/oauth/claude-code-client-metadata`                                               | none                          |
| VS Code     | `https://vscode.dev/oauth/client-metadata.json` (and Insiders)                                      | on `code.visualstudio.com`    |
| Gemini CLI  | its name only, so it stays unknown; its own name doesn't count as claiming Google's brand           | none                          |

Clients from one product share a `family`, which picks their mark: Gemini CLI and the Gemini app are both `gemini`. `identifyClient` returns the family only for a client it recognised, so a client known only by its name never gets a mark.

The Gemini app and Cursor are in `unverifiedClients`. Their rules come from one walkthrough and from forum reports, and haven't been checked in a real sign-in yet. Opt in with `[...defaultClients, ...unverifiedClients]`.

Add your own clients with `defineClient`. It refuses rules that would prove nothing, such as a loopback host or a plain HTTP redirect.

```ts
import { defaultClients, defineClient, identifyClient } from 'mcp-connect-kit';

const acme = defineClient({
  id: 'acme',
  name: 'Acme Agent',
  metadataUrls: ['https://acme.dev/oauth/client.json'],
  logoHosts: ['cdn.acme.dev'],
  brandNames: ['acme'],
});
identifyClient({ clientId, redirectUri, metadata, clients: [...defaultClients, acme] });
```

## Read a client metadata document

`readClientMetadata` checks a fetched document against what your server offers, and normalises it:

- `client_id` must equal the URL it came from.
- Only the grant and response types you offer are kept. So when a vendor adds a grant, as ChatGPT did with `jwt-bearer`, the document still works. It is refused only when nothing usable is left.
- Shared secrets, hidden characters in the name, and redirects with fragments are refused.
- `logo_uri`, `client_uri` and `jwks_uri` are kept only when they are HTTPS.

```ts
const document = readClientMetadata(json, {
  url,
  grants: ['authorization_code', 'refresh_token'],
  authMethods: ['none', 'private_key_jwt'],
});
```

It throws a `ClientMetadataError` whose `code` is `invalid_client_metadata`.

## Licence

MIT. Client names and logos belong to their owners. This project isn't affiliated with or endorsed by any of them.
