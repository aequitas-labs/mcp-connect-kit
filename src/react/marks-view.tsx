import type { ReactElement } from 'react';

import type { ClientIdentity } from '../clients/types.js';
import { useConnectSettings } from './frame.js';
import { BUNDLED_MARKS } from './marks.js';

/** Props for `ClientMark`. */
export interface ClientMarkProps {
  readonly client: ClientIdentity;
  /** The logo route path from `logoPath(client.logoUri)`, when `client.logo` is `metadata`. */
  readonly logoSrc?: string | undefined;
}

function NeutralIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6 text-mcpc-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5" />
    </svg>
  );
}

/**
 * The client's picture. In order: the logo from its metadata document,
 * served through your logo route; your mark for its id or family; the
 * bundled mark for its family; a
 * plug icon. A client the kit didn't recognise always gets the plug, whatever
 * name it sent.
 */
export function ClientMark({ client, logoSrc }: ClientMarkProps): ReactElement {
  const { marks } = useConnectSettings();
  const recognised = client.id !== null && client.via !== 'none';
  const AppMark =
    recognised && marks ? (marks[client.id ?? ''] ?? marks[client.family ?? '']) : undefined;
  const bundled = recognised && marks !== false ? BUNDLED_MARKS[client.family ?? ''] : undefined;

  let kind: 'logo' | 'mark' | 'neutral' = 'neutral';
  let picture: ReactElement = <NeutralIcon />;
  if (recognised && client.logo === 'metadata' && logoSrc) {
    kind = 'logo';
    picture = (
      <img src={logoSrc} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
    );
  } else if (AppMark) {
    kind = 'mark';
    picture = <AppMark />;
  } else if (bundled) {
    kind = 'mark';
    picture = (
      <svg
        viewBox={bundled.viewBox}
        className="h-7 w-7"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: bundled.body }}
      />
    );
  }
  return (
    <span
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-mcpc border border-mcpc-line bg-mcpc-page"
      data-mcpc-mark={kind}
    >
      {picture}
    </span>
  );
}

/** The client's picture, an arrow, and your app's: who is connecting to whom. */
export function ConnectionMarks({ client, logoSrc }: ClientMarkProps): ReactElement {
  const { theme } = useConnectSettings();
  const { icon, name } = theme.app;
  return (
    <div className="flex items-center justify-center gap-3" aria-hidden="true">
      <ClientMark client={client} logoSrc={logoSrc} />
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 text-mcpc-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 12h16M14 6l6 6-6 6" />
      </svg>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-mcpc border border-mcpc-line bg-mcpc-page text-sm font-semibold">
        {typeof icon === 'string' ? (
          <img src={icon} alt="" className="h-7 w-7 object-contain" />
        ) : (
          (icon ?? name.slice(0, 2))
        )}
      </span>
    </div>
  );
}
