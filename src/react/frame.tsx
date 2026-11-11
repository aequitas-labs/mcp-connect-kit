import { createContext, useContext } from 'react';
import type { ComponentType, ReactElement, ReactNode } from 'react';

import { defaultCopy } from './copy.js';
import type { ConnectCopy } from './copy.js';
import { themeStyle } from './theme.js';
import type { ConnectTheme } from './theme.js';

/** Your own marks for known clients, keyed by client id or family (such as `gemini`). Each draws itself at 28 × 28 pixels. */
export type ClientMarks = Readonly<Partial<Record<string, ComponentType>>>;

/** What every screen inside a `ConnectFrame` shares. */
export interface ConnectSettings {
  readonly theme: ConnectTheme;
  readonly copy: ConnectCopy;
  /** Your marks, or `false` to show no bundled marks at all. */
  readonly marks: ClientMarks | false;
}

const ConnectContext = createContext<ConnectSettings | null>(null);

/** Reads the frame's settings. Screens used outside a frame get the defaults with a placeholder app name. */
export function useConnectSettings(): ConnectSettings {
  return (
    useContext(ConnectContext) ?? {
      theme: { app: { name: 'this app' } },
      copy: defaultCopy,
      marks: {},
    }
  );
}

/** Joins class names, skipping empty ones. Your classes come last. */
export function classes(...names: readonly (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

/** Props for `ConnectFrame`. */
export interface ConnectFrameProps {
  readonly theme: ConnectTheme;
  /** Overrides for any default string. */
  readonly copy?: Partial<ConnectCopy>;
  /**
   * Your marks for known clients, which win over the bundled ones. Pass
   * `false` to show no bundled marks: clients then show their document's
   * logo, your marks, or a plug icon.
   */
  readonly marks?: ClientMarks | false;
  /** `auto` follows the device. Defaults to `auto`. */
  readonly colorScheme?: 'auto' | 'light' | 'dark';
  readonly className?: string;
  readonly children: ReactNode;
}

function AppLogo({ theme }: { readonly theme: ConnectTheme }): ReactElement {
  const { logo, name } = theme.app;
  if (typeof logo === 'string')
    return <img src={logo} alt={name} className="h-8 w-auto" data-mcpc-app-logo="" />;
  if (logo) return <span data-mcpc-app-logo="">{logo}</span>;
  return <span className="text-lg font-semibold">{name}</span>;
}

/**
 * The page around every sign-in and consent screen: your logo at the top,
 * your colours, and the copy and marks the screens inside it use.
 */
export function ConnectFrame(props: ConnectFrameProps): ReactElement {
  const settings: ConnectSettings = {
    theme: props.theme,
    copy: { ...defaultCopy, ...props.copy },
    marks: props.marks ?? {},
  };
  return (
    <ConnectContext.Provider value={settings}>
      <div
        className={classes(
          'mcpc min-h-full bg-mcpc-page font-mcpc text-mcpc-ink antialiased',
          props.className,
        )}
        data-mcpc-scheme={props.colorScheme ?? 'auto'}
        style={themeStyle(props.theme)}
      >
        <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8 sm:py-12">
          <header className="flex justify-center">
            <AppLogo theme={props.theme} />
          </header>
          <main className="rounded-mcpc border border-mcpc-line bg-mcpc-surface p-5 shadow-sm sm:p-6">
            {props.children}
          </main>
        </div>
      </div>
    </ConnectContext.Provider>
  );
}
