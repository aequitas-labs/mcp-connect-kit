import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';

const page = (file: string, query: string): string =>
  `${pathToFileURL(`stories/dist/${file}`).href}?${query}`;
// Screenshots land in test-results/screens. Ones a PR shows go on the pr-evidence branch, never on main.

async function shoot(browserPage: Page, name: string): Promise<void> {
  await browserPage.screenshot({
    path: `test-results/screens/${name}.png`,
    fullPage: true,
  });
}

test.describe('kit-screens:pres-phone — at 375 px, both buttons show with no sideways scroll, light and dark', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const client of ['chatgpt', 'gemini', 'unknown', 'spoof', 'local'] as const) {
      test(`${client}, ${scheme}`, async ({ page: browserPage }) => {
        await browserPage.setViewportSize({ width: 375, height: 812 });
        await browserPage.goto(page('built.html', `client=${client}&scheme=${scheme}`));
        const allow = browserPage.getByRole('button', { name: 'Allow access' });
        const deny = browserPage.getByRole('button', { name: "Don't allow" });
        await expect(allow).toBeVisible();
        await expect(deny).toBeVisible();
        const widths = await browserPage.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          view: window.innerWidth,
        }));
        expect(widths.scroll).toBeLessThanOrEqual(widths.view);
        for (const button of [allow, deny]) {
          const box = await button.boundingBox();
          expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
          expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
        }
        await shoot(browserPage, `consent-${client}-${scheme}-375`);
      });
    }
  }
});

test('kit-screens:ach-theme — a theme accent colours the Allow access button, and the header shows the logo', async ({
  page: browserPage,
}) => {
  await browserPage.goto(page('built.html', 'client=chatgpt&theme=green'));
  const allow = browserPage.getByRole('button', { name: 'Allow access' });
  await expect(allow).toHaveCSS('background-color', 'rgb(0, 187, 102)');
  await expect(browserPage.locator('header img[alt="Runhome"]')).toBeVisible();
  await shoot(browserPage, 'consent-chatgpt-green-theme');
});

test('kit-screens:ach-tailwind — a Tailwind app that sets --color-mcpc-accent colours the button with no theme prop', async ({
  page: browserPage,
}) => {
  await browserPage.goto(page('tailwind.html', 'client=claude'));
  await expect(browserPage.getByRole('button', { name: 'Allow access' })).toHaveCSS(
    'background-color',
    'rgb(225, 29, 72)',
  );
  await shoot(browserPage, 'consent-claude-tailwind-app');
});

test('dark mode follows the device when the scheme is auto', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'dark' });
  const browserPage = await context.newPage();
  await browserPage.goto(page('built.html', 'client=chatgpt').replace('scheme=', 'x='));
  await browserPage.evaluate(() =>
    document.querySelector('.mcpc')?.setAttribute('data-mcpc-scheme', 'auto'),
  );
  await expect(browserPage.locator('main')).toHaveCSS('background-color', 'rgb(17, 24, 39)');
  await context.close();
});
