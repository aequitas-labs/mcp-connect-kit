# mcp-connect-kit

Shared pieces for MCP servers that people connect to from ChatGPT, Claude, VS Code and other clients:

- **Recognise the client** from facts the server can check (its metadata document URL or its redirect URI), never from the name it sends.
- **Fetch client metadata documents and logos safely**, without reaching private addresses.
- **Sign-in and consent screens** in React and Tailwind, which name the client, say where the person goes back to, and warn about apps the server can't confirm.
- **Widget helpers** for MCP Apps and ChatGPT, where older template URIs keep working after a deploy.

The package is being built in small steps. It isn't on npm yet.

## Licence

MIT. Client names and logos belong to their owners. This project isn't affiliated with or endorsed by any of them.
