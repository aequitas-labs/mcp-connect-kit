# Changelog

## 0.1.0

The first release: sign-in and consent screens for MCP servers that use OAuth.

- **Know which app is connecting.** `identifyClient` works out the app from its client metadata document URL or its return address, never from its name, and says what to warn about. It knows ChatGPT, Codex, Claude, Claude Code and VS Code, and Gemini CLI by name only. The Gemini app and Cursor are opt-in until confirmed.
- **Read client metadata documents.** `readClientMetadata` checks a document and keeps only the grant types your server offers.
- **Fetch safely.** `createMetadataFetcher` and the logo route `createLogoProxy` use HTTPS, follow no redirects and refuse private addresses. `mcp-connect-kit/node` connects only to addresses it checked.
- **Screens.** `ConnectFrame`, `ConsentView`, `SignInHeader`, `DecisionView` and `ReturnView` for React, styled with Tailwind 4 or a built stylesheet, with logos for the apps the kit knows.
- **Better Auth.** `cimdOptions` for `@better-auth/cimd`, and `consentContext` for the consent page.
