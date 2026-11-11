/**
 * Every string the screens show. Override any of them through the `copy`
 * prop. `client` is already in quotes when the kit couldn't confirm who the
 * client is. `place` is where the person goes back to: a host such as
 * `chatgpt.com`, or `thisComputer` or `deviceApp`.
 */
export interface ConnectCopy {
  readonly signInHeading: (client: string) => string;
  readonly consentHeading: (client: string, app: string) => string;
  readonly scopesIntro: (client: string) => string;
  readonly returnLine: (place: string) => string;
  /** Where a loopback redirect goes, in words. */
  readonly thisComputer: string;
  /** Where a redirect through an app's own URL scheme goes, in words. */
  readonly deviceApp: string;
  readonly unknownWarning: (app: string) => string;
  readonly localWarning: () => string;
  readonly nameClaimWarning: (sentName: string, app: string) => string;
  readonly allow: string;
  readonly deny: string;
  readonly denied: (client: string) => string;
  readonly connected: (client: string, place: string) => string;
  readonly failed: (client: string) => string;
  readonly goBack: (client: string) => string;
}

/**
 * The default copy. Each screen names the app that's asking, says where the
 * person goes back to, and gives at most one warning, with the one thing to
 * check before allowing it.
 */
export const defaultCopy: ConnectCopy = {
  signInHeading: (client) => `Sign in to connect ${client}`,
  consentHeading: (client, app) => `Connect ${client} to ${app}`,
  scopesIntro: (client) => `${client} will be able to:`,
  returnLine: (place) => `You'll go back to ${place}.`,
  thisComputer: 'an app on your computer',
  deviceApp: 'an app on this device',
  unknownWarning: (app) =>
    `${app} doesn't recognise this app. Only allow it if you added it yourself.`,
  localWarning: () => 'This app runs on your computer. Only allow it if you started it.',
  nameClaimWarning: (sentName, app) =>
    `This app says it's "${sentName}", but ${app} can't confirm that. Only allow it if you added it yourself.`,
  allow: 'Allow access',
  deny: "Don't allow",
  denied: (client) => `${client} wasn't connected. You can close this page.`,
  connected: (client, place) => `${client} is connected. Taking you back to ${place}…`,
  failed: (client) => `We couldn't connect ${client}. Go back to ${client} and try again.`,
  goBack: (client) => `Go back to ${client}`,
};
