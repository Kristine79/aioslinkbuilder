import { describe, expect, it } from 'vitest';

import { extractCitations, parseSearchCapabilities } from '@aios/ai';

import { perplexitySonarResponse } from './fixtures.js';

describe('extractCitations', () => {
  it('extracts url_citation annotations from a real-format search response', () => {
    const { content, citations } = extractCitations(perplexitySonarResponse);
    expect(content.length).toBeGreaterThan(0);
    expect(citations).toHaveLength(4);
    expect(citations[0]).toMatchObject({
      url: 'https://www.maison-objet-exhibitions.com/ru/',
      title: 'Maison&Objet — выставка дизайна и мебели',
      startIndex: 5,
      endIndex: 12,
    });
    expect(citations.map((c) => c.url)).toEqual([
      'https://www.maison-objet-exhibitions.com/ru/',
      'https://www.interiors.ru/',
      'https://salon.ru/catalog/mebel',
      'https://design-mate.ru/',
    ]);
  });

  it('drops citations with non-http(s) URLs', () => {
    const payload = {
      choices: [
        {
          message: {
            content: 'text',
            annotations: [
              {
                type: 'url_citation',
                url_citation: { url: 'javascript:alert(1)', title: 'xss' },
              },
              { type: 'url_citation', url_citation: { url: 'ftp://example.com/f', title: 'ftp' } },
              {
                type: 'url_citation',
                url_citation: { url: 'https://ok.example/valid', title: 'ok' },
              },
              { type: 'text', text: 'https://not-a-citation.example/' },
            ],
          },
        },
      ],
    };
    const { citations } = extractCitations(payload);
    expect(citations).toEqual([
      {
        url: 'https://ok.example/valid',
        title: 'ok',
        startIndex: null,
        endIndex: null,
      },
    ]);
  });

  it('treats an empty title as null', () => {
    const payload = {
      choices: [
        {
          message: {
            content: 'text',
            annotations: [
              { type: 'url_citation', url_citation: { url: 'https://a.example/', title: '  ' } },
            ],
          },
        },
      ],
    };
    const { citations } = extractCitations(payload);
    expect(citations[0]?.title).toBeNull();
  });

  it('returns an empty citation list when annotations are absent (plain LLM answer)', () => {
    const payload = {
      choices: [{ message: { role: 'assistant', content: 'просто текст без ссылок' } }],
    };
    const { content, citations } = extractCitations(payload);
    expect(content).toBe('просто текст без ссылок');
    expect(citations).toEqual([]);
  });

  it('handles malformed envelopes without throwing', () => {
    expect(extractCitations(null)).toEqual({ content: '', citations: [] });
    expect(extractCitations('not an object')).toEqual({ content: '', citations: [] });
    expect(extractCitations({ choices: [] })).toEqual({ content: '', citations: [] });
  });

  it('parses annotations when url_citation is nested under the annotation record', () => {
    const payload = {
      choices: [
        {
          message: {
            content: 'text',
            annotations: [
              {
                type: 'url_citation',
                url_citation: { url: 'https://nested.example/', title: 'nested' },
              },
            ],
          },
        },
      ],
    };
    const { citations } = extractCitations(payload);
    expect(citations[0]?.url).toBe('https://nested.example/');
  });
});

describe('parseSearchCapabilities', () => {
  it('declares capabilities only from explicit tokens', () => {
    expect(parseSearchCapabilities({ declared: 'web_search,citations,usage' })).toEqual({
      supportsWebSearch: true,
      supportsCitations: true,
      supportsStructuredOutput: false,
      supportsUsage: true,
    });
  });

  it('returns null when nothing is declared (no name-based guessing)', () => {
    expect(parseSearchCapabilities({})).toBeNull();
    expect(parseSearchCapabilities({ declared: '' })).toBeNull();
  });

  it('normalizes whitespace and case', () => {
    expect(parseSearchCapabilities({ declared: '  Web_Search , Citations ' })).toMatchObject({
      supportsWebSearch: true,
      supportsCitations: true,
    });
  });

  it('never infers web search from the model name alone', () => {
    const caps = parseSearchCapabilities({ declared: 'usage' });
    expect(caps).not.toBeNull();
    expect(caps?.supportsWebSearch).toBe(false);
    expect(caps?.supportsCitations).toBe(false);
  });
});
