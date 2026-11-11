// Builds two pages for the browser checks: one styled with the built stylesheet,
// one styled by a Tailwind app's own build. Run `pnpm build` first.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

mkdirSync('stories/dist', { recursive: true });
await build({
  entryPoints: ['stories/consent.tsx'],
  bundle: true,
  format: 'iife',
  outfile: 'stories/dist/consent.js',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});
execFileSync(
  'pnpm',
  [
    'exec',
    'tailwindcss',
    '--input',
    'stories/tailwind-app.css',
    '--output',
    'stories/dist/tailwind-app.css',
  ],
  { stdio: 'inherit' },
);

const page = (stylesheet) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Consent</title><link rel="stylesheet" href="${stylesheet}"><style>html,body{margin:0;min-height:100vh}#root,#root>.mcpc{min-height:100vh}</style></head><body><div id="root"></div><script src="./consent.js"></script></body></html>`;
writeFileSync('stories/dist/built.html', page('../../dist/react/styles.css'));
writeFileSync('stories/dist/tailwind.html', page('./tailwind-app.css'));
