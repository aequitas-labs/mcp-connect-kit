/**
 * Every string the screens show. Override any of them through the `copy`
 * prop. `client` is already in quotes when the kit doesn't recognise it.
 */
export interface ConnectCopy {
  readonly signInHeading: (client: string) => string;
  readonly consentHeading: (client: string, app: string) => string;
  readonly scopesIntro: (client: string) => string;
  readonly returnLine: (host: string) => string;
  readonly unknownWarning: (app: string) => string;
  readonly localWarning: () => string;
  readonly nameClaimWarning: (sentName: string, app: string) => string;
  readonly allow: string;
  readonly deny: string;
  readonly denied: (client: string) => string;
  readonly connected: (client: string, host: string) => string;
  readonly failed: (client: string) => string;
  readonly goBack: (client: string) => string;
}

/** The default copy. Short, plain, and always naming the client and where the person goes back to. */
export const defaultCopy: ConnectCopy = {
  signInHeading: (client) => `Sign in to connect ${client}`,
  consentHeading: (client, app) => `Connect ${client} to ${app}`,
  scopesIntro: (client) => `${client} will be able to:`,
  returnLine: (host) => `You'll go back to ${host}.`,
  unknownWarning: (app) =>
    `${app} doesn't recognise this app. Only allow it if you added it yourself.`,
  localWarning: () => 'This app runs on your computer. Only allow it if you started it.',
  nameClaimWarning: (sentName, app) =>
    `This app calls itself "${sentName}", but ${app} can't confirm it. Only allow it if you added it yourself.`,
  allow: 'Allow access',
  deny: "Don't allow",
  denied: (client) => `${client} wasn't connected. You can close this page.`,
  connected: (client, host) => `${client} is connected. Going back to ${host}…`,
  failed: (client) => `We couldn't connect ${client}. Go back to ${client} and try again.`,
  goBack: (client) => `Go back to ${client}`,
};
