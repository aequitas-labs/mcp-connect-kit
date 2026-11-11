import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  CARD_MIME_TYPE,
  CardError,
  cardToolMeta,
  cardUri,
  defineCard,
  registerCards,
} from '../../src/widgets/index.js';
import type { Card } from '../../src/widgets/index.js';
import { buildCard } from '../../src/widgets/build.js';

async function card(name: string, html: string): Promise<Card> {
  return defineCard({
    app: 'runhome',
    name,
    html,
    uri: await cardUri('runhome', name, html),
    title: `Runhome ${name}`,
  });
}

async function connected(cards: readonly Card[]): Promise<Client> {
  const server = new McpServer({ name: 'cards-test', version: '1.0.0' });
  registerCards(server, cards, {
    domain: 'https://cards.runhome.example',
    csp: { connectDomains: ['https://api.runhome.example'] },
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'host', version: '1.0.0' });
  await client.connect(clientTransport);
  return client;
}

describe('registerCards', () => {
  it('kit-widgets:ach-old-uri — an earlier revision of a card answers with the current HTML', async () => {
    const estimate = await card('estimate', '<!doctype html><p>Estimate, version 2</p>');
    const client = await connected([estimate]);
    const old = 'ui://runhome/estimate-0000000000000000.html';
    const result = await client.readResource({ uri: old });
    const content = result.contents[0] as {
      uri: string;
      text: string;
      mimeType: string;
      _meta: Record<string, unknown>;
    };
    expect(content.uri).toBe(old);
    expect(content.text).toBe(estimate.html);
    expect(content.mimeType).toBe(CARD_MIME_TYPE);
    expect(content._meta['openai/widgetDomain']).toBe('https://cards.runhome.example');
  });

  it('kit-widgets:pres-listed — resources/list shows exactly one URI per card, the current one', async () => {
    const cards = [await card('estimate', '<p>e</p>'), await card('connection', '<p>c</p>')];
    const client = await connected(cards);
    const listed = (await client.listResources()).resources.map((resource) => resource.uri).sort();
    expect(listed).toEqual(cards.map((each) => each.uri).sort());
  });

  it('the current URI still answers, and carries both _meta dialects', async () => {
    const estimate = await card('estimate', '<p>e</p>');
    const client = await connected([estimate]);
    const content = (await client.readResource({ uri: estimate.uri })).contents[0] as {
      _meta: Record<string, unknown>;
    };
    expect(content._meta.ui).toEqual({
      domain: 'https://cards.runhome.example',
      csp: {
        connectDomains: ['https://api.runhome.example'],
        resourceDomains: [],
        frameDomains: [],
      },
      prefersBorder: true,
    });
    expect(content._meta['openai/widgetCSP']).toMatchObject({
      connect_domains: ['https://api.runhome.example'],
    });
  });

  it("doesn't answer for another card's name", async () => {
    const client = await connected([await card('estimate', '<p>e</p>')]);
    await expect(
      client.readResource({ uri: 'ui://runhome/other-0000000000000000.html' }),
    ).rejects.toThrow();
  });
});

describe('cardToolMeta', () => {
  it('kit-widgets:ach-meta — points a tool at a card in both dialects, with the same URI', async () => {
    const estimate = await card('estimate', '<p>e</p>');
    const meta = cardToolMeta(estimate, { visibility: ['model', 'app'] });
    expect(meta).toEqual({
      ui: { resourceUri: estimate.uri, visibility: ['model', 'app'] },
      'ui/resourceUri': estimate.uri,
      'openai/outputTemplate': estimate.uri,
      'openai/widgetAccessible': true,
    });
  });
});

describe('defineCard', () => {
  it('refuses a URI that the earlier-revision template could not answer', () => {
    expect(() =>
      defineCard({
        app: 'runhome',
        name: 'estimate',
        html: '<p/>',
        uri: 'ui://runhome/estimate.html',
      }),
    ).toThrow(CardError);
    expect(() =>
      defineCard({
        app: 'Runhome',
        name: 'estimate',
        html: '<p/>',
        uri: 'ui://Runhome/estimate-abcdef12.html',
      }),
    ).toThrow(CardError);
  });
});

describe('buildCard', () => {
  it('inlines the script and Tailwind styles into one file, named by its content', async () => {
    const fixtures = join(import.meta.dirname, '../fixtures/card');
    const built = await buildCard({
      app: 'runhome',
      name: 'hello',
      entry: join(fixtures, 'hello.tsx'),
      css: join(fixtures, 'theme.css'),
      title: 'Hello <card>',
    });
    expect(built.uri).toMatch(/^ui:\/\/runhome\/hello-[0-9a-f]{16}\.html$/);
    expect(built.uri).toBe(await cardUri('runhome', 'hello', built.html));
    expect(built.html).toContain('<title>Hello &lt;card&gt;</title>');
    expect(built.html).toContain('.text-emerald-700');
    expect(built.html).toContain('<\\/script> stays inside the script');
    expect(built.html.match(/<\/script>/g)).toHaveLength(1);
    expect(built.mimeType).toBe(CARD_MIME_TYPE);
  });
});
