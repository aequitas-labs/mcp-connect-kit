/**
 * mcp-connect-kit/widgets/build: turns a card's React (or plain) entry and
 * its stylesheet into one self-contained HTML file, named by its content.
 * Node only, at build time. Needs `esbuild`, and `postcss` with
 * `@tailwindcss/postcss` when the stylesheet uses Tailwind.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { cardUri, defineCard } from './card.js';
import type { Card } from './card.js';

/** Options for `buildCard`. */
export interface BuildCardOptions {
  readonly app: string;
  readonly name: string;
  /** The card's entry file, such as `src/estimate.tsx`. It renders into `#root`. */
  readonly entry: string;
  /** A stylesheet to inline. Compiled with Tailwind when it imports `tailwindcss`. */
  readonly css?: string;
  readonly title?: string;
  readonly description?: string;
  /** Extra `define` replacements for esbuild, such as feature flags. */
  readonly define?: Readonly<Record<string, string>>;
  /** When set, also writes `<name>.html` and `<name>.card.json` there. */
  readonly outDir?: string;
}

/** Keeps inlined code from closing its own tag early. */
function inlineSafe(code: string, tag: 'script' | 'style'): string {
  return code.replaceAll(`</${tag}`, `<\\/${tag}`);
}

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

async function bundleScript(options: BuildCardOptions): Promise<string> {
  const { build } = await import('esbuild');
  const result = await build({
    entryPoints: [options.entry],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    metafile: true,
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"', ...options.define },
    logLevel: 'silent',
  });
  for (const output of Object.values(result.metafile.outputs)) {
    if (output.imports.length > 0)
      throw new Error(`${options.name} must not import anything at runtime`);
  }
  const script = result.outputFiles[0];
  if (!script) throw new Error(`esbuild produced no output for ${options.entry}`);
  return script.text;
}

async function compileStylesheet(path: string): Promise<string> {
  const source = await readFile(path, 'utf8');
  if (!/@import\s+['"]tailwindcss/.test(source)) return source;
  const [{ default: postcss }, { default: tailwindcss }] = await Promise.all([
    import('postcss'),
    import('@tailwindcss/postcss'),
  ]);
  const result = await postcss([tailwindcss({ base: dirname(path), optimize: true })]).process(
    source,
    { from: path },
  );
  return result.css;
}

/**
 * Bundles a card into one HTML file with its script and styles inline, and
 * names it `ui://<app>/<name>-<revision>.html` from its content. Pass the
 * result to `defineCard`-based `registerCards`.
 */
export async function buildCard(options: BuildCardOptions): Promise<Card> {
  const [script, css] = await Promise.all([
    bundleScript(options),
    options.css ? compileStylesheet(options.css) : Promise.resolve(''),
  ]);
  const title = options.title ?? options.name;
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<title>${escapeHtml(title)}</title><style>${inlineSafe(css, 'style')}</style></head>` +
    `<body><div id="root"></div><script>${inlineSafe(script, 'script')}</script></body></html>`;
  const card = defineCard({
    app: options.app,
    name: options.name,
    uri: await cardUri(options.app, options.name, html),
    html,
    title,
    ...(options.description ? { description: options.description } : {}),
  });
  if (options.outDir) {
    await mkdir(options.outDir, { recursive: true });
    await writeFile(join(options.outDir, `${options.name}.html`), html);
    await writeFile(
      join(options.outDir, `${options.name}.card.json`),
      `${JSON.stringify(card, null, 2)}\n`,
    );
  }
  return card;
}
