import { describe, expect, it, vi } from 'vitest';

import {
  AISearchCitationsProvider,
  ProviderError,
  type SearchCitationsPort,
} from '@aios/integrations';

function fakePort(citations: Array<{ url: string; title: string | null }>): SearchCitationsPort {
  return {
    providerName: 'ai-search',
    model: 'perplexity/sonar',
    searchCitations: vi.fn().mockResolvedValue(citations),
  };
}

describe('AISearchCitationsProvider', () => {
  it('maps real citations into WebSearchResult with source=ai-search', async () => {
    const port = fakePort([
      { url: 'https://www.interiors.ru/', title: 'Interiors+The Future' },
      { url: 'https://salon.ru/catalog/mebel', title: 'Salon.ru каталог' },
    ]);
    const provider = new AISearchCitationsProvider(port);

    const results = await provider.search('мебельные каталоги');

    expect(results).toEqual([
      {
        url: 'https://www.interiors.ru/',
        title: 'Interiors+The Future',
        snippet: null,
        domain: 'interiors.ru',
        source: 'ai-search',
      },
      {
        url: 'https://salon.ru/catalog/mebel',
        title: 'Salon.ru каталог',
        snippet: null,
        domain: 'salon.ru',
        source: 'ai-search',
      },
    ]);
    expect(port.searchCitations).toHaveBeenCalledWith('мебельные каталоги', {
      maxResults: 10,
    });
  });

  it('drops invalid or non-http(s) citation URLs', async () => {
    const port = fakePort([
      { url: 'not-a-url', title: 'bad' },
      { url: 'https://ok.example/', title: 'ok' },
      { url: '', title: 'empty' },
    ]);
    const provider = new AISearchCitationsProvider(port);

    const results = await provider.search('q');
    expect(results).toHaveLength(1);
    expect(results[0]?.url).toBe('https://ok.example/');
  });

  it('treats a null citation title as null in the result', async () => {
    const port = fakePort([{ url: 'https://x.example/', title: null }]);
    const provider = new AISearchCitationsProvider(port);
    const results = await provider.search('q');
    expect(results[0]).toMatchObject({ url: 'https://x.example/', title: null });
  });

  it('fails loudly when no citations were returned (no prose-as-sites)', async () => {
    const port = fakePort([]);
    const provider = new AISearchCitationsProvider(port);
    await expect(provider.search('q')).rejects.toThrow(ProviderError);
  });

  it('wraps client failures into a ProviderError', async () => {
    const port: SearchCitationsPort = {
      providerName: 'ai-search',
      model: 'perplexity/sonar',
      searchCitations: vi
        .fn()
        .mockRejectedValue(new Error('Search provider returned no citations')),
    };
    const provider = new AISearchCitationsProvider(port);
    const error = await provider.search('мебельные каталоги').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).providerName).toBe('ai-search');
    expect((error as ProviderError).message).toContain('no citations');
  });

  it('respects a custom maxResults', async () => {
    const port = fakePort([
      { url: 'https://a.example/', title: 'a' },
      { url: 'https://b.example/', title: 'b' },
      { url: 'https://c.example/', title: 'c' },
    ]);
    const provider = new AISearchCitationsProvider(port);
    const results = await provider.search('q', { maxResults: 2 });
    expect(results).toHaveLength(2);
    expect(port.searchCitations).toHaveBeenCalledWith('q', { maxResults: 2 });
  });

  it('returns no results for a blank query without calling the port', async () => {
    const port = fakePort([{ url: 'https://a.example/', title: 'a' }]);
    const provider = new AISearchCitationsProvider(port);
    await expect(provider.search('   ')).resolves.toEqual([]);
    expect(port.searchCitations).not.toHaveBeenCalled();
  });
});
