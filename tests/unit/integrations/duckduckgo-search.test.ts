import { describe, expect, it } from 'vitest';

import { DuckDuckGoSearchProvider, domainOf, parseResults } from '@aios/integrations';

const SAMPLE_HTML = `
<form id="search_form_homepage" action="/html/" method="post">
  <input type="text" name="q" value="">
</form>
<div class="result results_links results_links_deep web-result">
  <h2 class="result__title">
    <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fcatalog.example.com%2Ffabriki&rut=abc">Каталог фабрик мебели</a>
  </h2>
  <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fcatalog.example.com%2Ffabriki&rut=abc">Реестр производителей &amp; поставщиков</a>
</div>
<div class="result results_links results_links_deep web-result">
  <h2 class="result__title">
    <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.mebel.example.org%2F&rut=def">Мебель на заказ</a>
  </h2>
</div>
`;

describe('parseResults', () => {
  it('extracts results and unwraps DuckDuckGo redirect links', () => {
    const results = parseResults(SAMPLE_HTML, 'duckduckgo');
    expect(results).toHaveLength(2);
    expect(results[0]?.url).toBe('https://catalog.example.com/fabriki');
    expect(results[0]?.title).toBe('Каталог фабрик мебели');
    expect(results[0]?.snippet).toBe('Реестр производителей & поставщиков');
    expect(results[0]?.domain).toBe('catalog.example.com');
    expect(results[0]?.source).toBe('duckduckgo');
  });

  it('skips blocks without a title or with invalid URLs', () => {
    const results = parseResults(
      '<div class="result"><h2 class="result__title"></h2></div>',
      'ddg',
    );
    expect(results).toEqual([]);
  });

  it('dedupes results by normalized URL', () => {
    const html = `
      <div class="result"><a class="result__a" href="https://a.example/x">A</a></div>
      <div class="result"><a class="result__a" href="https://a.example/x">A again</a></div>
      <div class="result"><a class="result__a" href="https://a.example/x?utm=1">A utm</a></div>
    `;
    const results = parseResults(html, 'ddg');
    expect(results).toHaveLength(1);
  });
});

describe('domainOf', () => {
  it('extracts the registered domain without www', () => {
    expect(domainOf('https://www.Example.com/path')).toBe('example.com');
    expect(domainOf('http://sub.example.org:8080/x')).toBe('sub.example.org');
    expect(domainOf('not a url')).toBeNull();
  });
});

describe('DuckDuckGoSearchProvider', () => {
  it('caps results at maxResults and propagates engine failures', async () => {
    const fetchImpl = () => Promise.resolve(new Response(SAMPLE_HTML, { status: 200 }));
    const provider = new DuckDuckGoSearchProvider({ fetchImpl, timeoutMs: 1000 });
    const results = await provider.search('мебель', { maxResults: 1 });
    expect(results).toHaveLength(1);
    expect(results[0]?.url).toBe('https://catalog.example.com/fabriki');
  });

  it('maps rate limiting to a RATE_LIMIT ProviderError', async () => {
    const fetchImpl = () => Promise.resolve(new Response('', { status: 429 }));
    const provider = new DuckDuckGoSearchProvider({ fetchImpl, timeoutMs: 1000 });
    await expect(provider.search('x')).rejects.toMatchObject({ category: 'RATE_LIMIT' });
  });
});
