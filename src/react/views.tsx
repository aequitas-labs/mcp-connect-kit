import type { ReactElement } from 'react';

import type { ClientIdentity } from '../clients/types.js';
import type { ConnectCopy } from './copy.js';
import { classes, useConnectSettings } from './frame.js';
import { ConnectionMarks } from './marks-view.js';

/** The client's name as the screens write it: in quotes when the kit couldn't confirm it. */
export function clientLabel(client: ClientIdentity): string {
  return client.via === 'none' ? `"${client.name}"` : client.name;
}

/** Where the person goes back to, in words they'd recognise. */
export function returnPlace(client: ClientIdentity, copy: ConnectCopy): string {
  if (client.returnsTo === 'this-computer') return copy.thisComputer;
  if (client.returnsTo === 'device-app') return copy.deviceApp;
  return client.returnHost;
}

/**
 * The one warning line a screen shows, or `null`. A client on this computer
 * gets the "runs on your computer" line; otherwise a client whose name
 * claims a brand gets that line; otherwise an unknown client gets the
 * "doesn't recognise" line.
 */
export function warningText(
  client: ClientIdentity,
  copy: ConnectCopy,
  appName: string,
): string | null {
  if (client.warnings.includes('localhost-only')) return copy.localWarning();
  if (client.warnings.includes('name-claims-known-brand'))
    return copy.nameClaimWarning(client.name, appName);
  if (client.warnings.includes('unknown-client')) return copy.unknownWarning(appName);
  return null;
}

function Warning({
  text,
  className,
}: {
  readonly text: string | null;
  readonly className?: string | undefined;
}): ReactElement | null {
  if (!text) return null;
  return (
    <p
      role="note"
      className={classes(
        'rounded-mcpc bg-mcpc-warn-bg px-3 py-2 text-sm text-mcpc-warn-ink',
        className,
      )}
      data-mcpc-warning=""
    >
      {text}
    </p>
  );
}

/** A permission the person grants, in their words, such as "See your estimates". */
export interface ScopeLine {
  readonly id: string;
  readonly label: string;
}

/** Parts of the consent screen that take your own class names. */
export type ConsentPart = 'heading' | 'warning' | 'scopes' | 'returnLine' | 'allow' | 'deny';

/** Props for `ConsentView`. */
export interface ConsentViewProps {
  readonly client: ClientIdentity;
  readonly scopes: readonly ScopeLine[];
  readonly onAllow: () => void;
  readonly onDeny: () => void;
  /** From `logoPath(client.logoUri)` when `client.logo` is `metadata`. */
  readonly logoSrc?: string | undefined;
  /** Disables both buttons while the decision is being sent. */
  readonly busy?: boolean | undefined;
  readonly copy?: Partial<ConnectCopy> | undefined;
  readonly classNames?: Partial<Record<ConsentPart, string>> | undefined;
}

/**
 * Asks the person to let the client in. It names the client, warns when the
 * kit can't confirm who it is, lists what it will be able to do, and says
 * where the person goes back to.
 */
export function ConsentView(props: ConsentViewProps): ReactElement {
  const settings = useConnectSettings();
  const copy = { ...settings.copy, ...props.copy };
  const appName = settings.theme.app.name;
  const label = clientLabel(props.client);
  const parts = props.classNames ?? {};
  return (
    <section className="flex flex-col gap-5" aria-labelledby="mcpc-consent-heading">
      <ConnectionMarks client={props.client} logoSrc={props.logoSrc} />
      <h1
        id="mcpc-consent-heading"
        className={classes(
          'text-center text-xl leading-snug font-semibold text-balance',
          parts.heading,
        )}
      >
        {copy.consentHeading(label, appName)}
      </h1>
      <Warning text={warningText(props.client, copy, appName)} className={parts.warning} />
      {props.scopes.length > 0 && (
        <div className={classes('flex flex-col gap-2', parts.scopes)}>
          <p className="text-sm text-mcpc-muted">{copy.scopesIntro(label)}</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {props.scopes.map((scope) => (
              <li key={scope.id} className="flex gap-2">
                <span aria-hidden="true" className="text-mcpc-accent">
                  •
                </span>
                {scope.label}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p
        className={classes('text-sm text-mcpc-muted', parts.returnLine)}
        data-mcpc-return-host={props.client.returnHost}
      >
        {copy.returnLine(returnPlace(props.client, copy))}
      </p>
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <button
          type="button"
          onClick={props.onDeny}
          disabled={props.busy}
          className={classes(
            'min-h-11 flex-1 rounded-mcpc border border-mcpc-line px-4 py-2.5 text-sm font-medium disabled:opacity-60',
            parts.deny,
          )}
        >
          {copy.deny}
        </button>
        <button
          type="button"
          onClick={props.onAllow}
          disabled={props.busy}
          className={classes(
            'min-h-11 flex-1 rounded-mcpc bg-mcpc-accent px-4 py-2.5 text-sm font-medium text-mcpc-accent-ink disabled:opacity-60',
            parts.allow,
          )}
          data-mcpc-allow=""
        >
          {copy.allow}
        </button>
      </div>
    </section>
  );
}

/** Props for `SignInHeader`. */
export interface SignInHeaderProps {
  readonly client: ClientIdentity;
  readonly logoSrc?: string | undefined;
  readonly copy?: Partial<ConnectCopy> | undefined;
}

/** The top of your sign-in form: who is asking, and any warning. Put your own sign-in fields under it. */
export function SignInHeader(props: SignInHeaderProps): ReactElement {
  const settings = useConnectSettings();
  const copy = { ...settings.copy, ...props.copy };
  return (
    <div className="flex flex-col gap-4">
      <ConnectionMarks client={props.client} logoSrc={props.logoSrc} />
      <h1 className="text-center text-xl leading-snug font-semibold text-balance">
        {copy.signInHeading(clientLabel(props.client))}
      </h1>
      <Warning text={warningText(props.client, copy, settings.theme.app.name)} />
    </div>
  );
}

/** Props for `DecisionView`. */
export interface DecisionViewProps {
  readonly client: ClientIdentity;
  /** `allowed` and `denied` follow the person's choice; `failed` is for a sign-in that broke. */
  readonly outcome: 'allowed' | 'denied' | 'failed';
  readonly logoSrc?: string | undefined;
  readonly copy?: Partial<ConnectCopy> | undefined;
}

/** What happened after the person decided. */
export function DecisionView(props: DecisionViewProps): ReactElement {
  const settings = useConnectSettings();
  const copy = { ...settings.copy, ...props.copy };
  const label = clientLabel(props.client);
  const message =
    props.outcome === 'allowed'
      ? copy.connected(label, returnPlace(props.client, copy))
      : props.outcome === 'denied'
        ? copy.denied(label)
        : copy.failed(label);
  return (
    <section className="flex flex-col gap-5 text-center" data-mcpc-outcome={props.outcome}>
      <ConnectionMarks client={props.client} logoSrc={props.logoSrc} />
      <p role="status" className="text-base">
        {message}
      </p>
    </section>
  );
}

/** Props for `ReturnView`. */
export interface ReturnViewProps {
  readonly client: ClientIdentity;
  /** Where to send the person, usually the redirect with the code. */
  readonly returnUrl: string;
  readonly logoSrc?: string | undefined;
  readonly copy?: Partial<ConnectCopy> | undefined;
}

/**
 * Shown while the person goes back to the client. The link is there for a
 * browser that blocks the automatic return.
 */
export function ReturnView(props: ReturnViewProps): ReactElement {
  const settings = useConnectSettings();
  const copy = { ...settings.copy, ...props.copy };
  const label = clientLabel(props.client);
  return (
    <section className="flex flex-col items-center gap-5 text-center">
      <ConnectionMarks client={props.client} logoSrc={props.logoSrc} />
      <p role="status">{copy.connected(label, returnPlace(props.client, copy))}</p>
      <a
        href={props.returnUrl}
        className="text-sm font-medium text-mcpc-accent underline underline-offset-4"
      >
        {copy.goBack(label)}
      </a>
    </section>
  );
}
