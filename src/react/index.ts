/**
 * mcp-connect-kit/react: sign-in and consent screens that name the client,
 * warn about apps the server can't confirm, and say where the person goes
 * back to. Style them with Tailwind 4 (`mcp-connect-kit/tailwind.css`) or the
 * built stylesheet (`mcp-connect-kit/react/styles.css`).
 */
export { defaultCopy } from './copy.js';
export type { ConnectCopy } from './copy.js';
export { classes, ConnectFrame, useConnectSettings } from './frame.js';
export type { ClientMarks, ConnectFrameProps, ConnectSettings } from './frame.js';
export { BUNDLED_MARKS } from './marks.js';
export type { BundledMark } from './marks.js';
export { ClientMark, ConnectionMarks } from './marks-view.js';
export type { ClientMarkProps } from './marks-view.js';
export { themeStyle } from './theme.js';
export type { ConnectApp, ConnectColors, ConnectTheme } from './theme.js';
export {
  clientLabel,
  ConsentView,
  DecisionView,
  ReturnView,
  SignInHeader,
  warningText,
} from './views.js';
export type {
  ConsentPart,
  ConsentViewProps,
  DecisionViewProps,
  ReturnViewProps,
  ScopeLine,
  SignInHeaderProps,
} from './views.js';
