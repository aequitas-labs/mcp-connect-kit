import type { CSSProperties, ReactNode } from 'react';

/** Colours for one colour scheme. Any CSS colour works. */
export interface ConnectColors {
  /** The Allow access button and links. */
  readonly accent?: string;
  /** Text on the accent colour. */
  readonly accentInk?: string;
  /** Behind the whole screen. */
  readonly page?: string;
  /** The card the screen sits on. */
  readonly surface?: string;
  readonly ink?: string;
  readonly muted?: string;
  readonly line?: string;
  readonly warnBackground?: string;
  readonly warnInk?: string;
}

/** Your app, as the screens show it. */
export interface ConnectApp {
  /** Your app's name, as people know it, such as `Runhome`. */
  readonly name: string;
  /** Your logo or wordmark: an image URL, or any element. Shown at the top of every screen. */
  readonly logo?: string | ReactNode;
  /**
   * A square icon, shown in a small tile beside the client's mark. Without
   * one, the tile shows your app's first two letters.
   */
  readonly icon?: string | ReactNode;
}

/** How the screens look. Everything but `app` has a default. */
export interface ConnectTheme {
  readonly app: ConnectApp;
  /** Light colours. They are also the dark colours when `dark` leaves one out, except page, surface and ink. */
  readonly color?: ConnectColors;
  readonly dark?: ConnectColors;
  /** A CSS font stack. */
  readonly font?: string;
  /** Corner radius in pixels. */
  readonly radius?: number;
}

const COLOR_VARIABLES: Readonly<Record<keyof ConnectColors, string>> = {
  accent: 'accent',
  accentInk: 'accent-ink',
  page: 'page',
  surface: 'surface',
  ink: 'ink',
  muted: 'muted',
  line: 'line',
  warnBackground: 'warn-bg',
  warnInk: 'warn-ink',
};

/**
 * Turns a theme into the CSS variables the screens read. The stylesheet maps
 * `--mcpc-light-*` and `--mcpc-dark-*` onto `--mcpc-*` for the active scheme.
 */
export function themeStyle(theme: ConnectTheme): CSSProperties {
  const style: Record<string, string> = {};
  for (const [scheme, colors] of [
    ['light', theme.color],
    ['dark', theme.dark],
  ] as const) {
    for (const [key, value] of Object.entries(colors ?? {})) {
      const name = COLOR_VARIABLES[key as keyof ConnectColors];
      if (name && value) style[`--mcpc-${scheme}-${name}`] = value;
    }
  }
  if (theme.font) style['--mcpc-font'] = theme.font;
  if (theme.radius !== undefined) style['--mcpc-radius'] = `${theme.radius}px`;
  return style as CSSProperties;
}
