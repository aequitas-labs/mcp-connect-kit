// Copies the Tailwind entry and tokens next to the compiled screens, and builds
// the stylesheet for apps without Tailwind.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist/react', { recursive: true });
for (const file of ['tailwind.css', 'tokens.css'])
  copyFileSync(`src/react/${file}`, `dist/react/${file}`);
execFileSync(
  'pnpm',
  [
    'exec',
    'tailwindcss',
    '--input',
    'src/react/styles.source.css',
    '--output',
    'dist/react/styles.css',
    '--minify',
  ],
  {
    stdio: 'inherit',
  },
);
