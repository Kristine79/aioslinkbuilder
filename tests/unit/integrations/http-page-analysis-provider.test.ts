import { describe, expect, it } from 'vitest';

import { HttpPageAnalysisProvider } from '@aios/integrations';
import { parseHtmlDocument } from '@aios/integrations';

const HTML = `<!doctype html>
<html><head>
  <title>Каталог мебельных фабрик — Example</title>
  <meta name="description" content="Каталог производителей мебели">
  <link rel="canonical" href="https://catalog.example.com/fabriki">
</head><body>
  <h1>Производители мебели</h1>
  <p>Список фабрик и мастерских по производству мебели на заказ.</p>
  <a href="https://partner.example.com">партнёр</a>
  <a href="/about">о нас</a>
</body></html>`;

function htmlResponse(body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers },
  });
}

describe('parseHtmlDocument', () => {
  it('extracts title, canonical, description, headings, text and links', () => {
    const page = parseHtmlDocument(HTML);
    expect(page.title).toBe('Каталог мебельных фабрик — Example');
    expect(page.canonical).toBe('https://catalog.example.com/fabriki');
    expect(page.description).toBe('Каталог производителей мебели');
    expect(page.headings).toEqual(['Производители мебели']);
    expect(page.wordCount).toBeGreaterThan(0);
    expect(page.outboundLinks).toEqual({ total: 2, external: 1 });
    expect(page.text.length).toBeLessThanOrEqual(12_000);
  });

  it('never throws on malformed markup', () => {
    const page = parseHtmlDocument('<html><body><h1>Unclosed');
    expect(page.title).toBeNull();
    expect(page.text).toBe('Unclosed');
    expect(page.wordCount).toBe(1);
  });
});

describe('HttpPageAnalysisProvider', () => {
  it('returns MEASURED indexation/outbound signals and UNKNOWN rest for a live page', async () => {
    const provider = new HttpPageAnalysisProvider({
      timeoutMs: 1000,
      fetchImpl: () => Promise.resolve(htmlResponse(HTML)),
    });
    const result = await provider.analyzePage({
      platformName: 'catalog.example.com',
      url: 'https://catalog.example.com/fabriki',
    });

    expect(result.targetDomain).toBe('catalog.example.com');
    expect(result.pageTitle).toBe('Каталог мебельных фабрик — Example');
    expect(result.indexation.status).toBe('MEASURED');
    expect(result.indexation.source).toBe('http');
    expect(result.indexation.value).toBe('INDEXED');
    expect(result.outboundLinkSignals.status).toBe('MEASURED');
    expect(result.outboundLinkSignals.value).toMatchObject({ total: 2, external: 1 });
    expect(result.topicalRelevance.status).toBe('UNKNOWN');
    expect(result.linkInsertSuitability.status).toBe('UNKNOWN');
    expect(result.traffic.status).toBe('UNKNOWN');
  });

  it('respects robots meta for indexation', async () => {
    const provider = new HttpPageAnalysisProvider({
      timeoutMs: 1000,
      fetchImpl: () =>
        Promise.resolve(
          htmlResponse('<html><head><meta name="robots" content="noindex"></head></html>'),
        ),
    });
    const result = await provider.analyzePage({ platformName: 'x', url: 'https://x.example/' });
    expect(result.indexation.value).toBe('NOT_INDEXED');
    expect(result.indexation.status).toBe('MEASURED');
  });

  it('returns all-UNKNOWN analysis when the page cannot be fetched', async () => {
    const provider = new HttpPageAnalysisProvider({
      timeoutMs: 1000,
      fetchImpl: () => Promise.reject(new TypeError('network down')),
    });
    const result = await provider.analyzePage({ platformName: 'x', url: 'https://x.example/' });
    expect(result.pageType).toBe('UNKNOWN');
    expect(result.indexation.status).toBe('UNKNOWN');
    expect(result.outboundLinkSignals.status).toBe('UNKNOWN');
  });

  it('returns all-UNKNOWN for non-HTML responses', async () => {
    const provider = new HttpPageAnalysisProvider({
      timeoutMs: 1000,
      fetchImpl: () =>
        Promise.resolve(
          new Response('{"not":"html"}', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
    });
    const result = await provider.analyzePage({ platformName: 'x', url: 'https://x.example/' });
    expect(result.indexation.status).toBe('UNKNOWN');
  });

  it('returns all-UNKNOWN for missing or invalid URLs', async () => {
    const provider = new HttpPageAnalysisProvider({ timeoutMs: 1000 });
    const result = await provider.analyzePage({ platformName: 'x', url: null });
    expect(result.indexation.status).toBe('UNKNOWN');
  });

  it('follows redirects up to the limit, then gives up as UNKNOWN', async () => {
    let calls = 0;
    const provider = new HttpPageAnalysisProvider({
      timeoutMs: 1000,
      maxRedirects: 2,
      fetchImpl: (_input) => {
        calls += 1;
        if (calls < 4) {
          return Promise.resolve(
            new Response('', { status: 302, headers: { Location: 'https://y.example/' } }),
          );
        }
        return Promise.resolve(htmlResponse('<html><title>T</title></html>'));
      },
    });
    const result = await provider.analyzePage({ platformName: 'x', url: 'https://x.example/' });
    expect(result.indexation.status).toBe('UNKNOWN');
    expect(calls).toBeLessThanOrEqual(3);
  });
});
