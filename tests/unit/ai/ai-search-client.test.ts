import { describe, expect, it, vi } from 'vitest';

import {
  AISearchClient,
  AISearchClientError,
  AISearchConfigError,
  AISearchNoCitationsError,
} from '@aios/ai';

import { perplexitySonarResponse } from './fixtures.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface SentRequest {
  model?: string;
  messages?: Array<{ role: string; content: string }>;
  headers?: Record<string, string>;
}

function sentRequest(
  fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>,
  callIndex = 0,
): SentRequest {
  const init = fetchImpl.mock.calls[callIndex]?.[1];
  const body = init?.body;
  const parsed = JSON.parse(typeof body === 'string' ? body : '{}') as SentRequest;
  return { ...parsed, headers: (init?.headers ?? {}) as Record<string, string> };
}

const CAPABILITIES = {
  supportsWebSearch: true,
  supportsCitations: true,
  supportsStructuredOutput: true,
  supportsUsage: true,
};

describe('AISearchClient', () => {
  it('rejects an empty API key at construction', () => {
    expect(() => new AISearchClient({ apiKey: '   ' })).toThrow(AISearchConfigError);
  });

  it('rejects web search when capabilities are not declared', async () => {
    const client = new AISearchClient({
      apiKey: 'key',
      model: 'perplexity/sonar',
      capabilities: {
        supportsWebSearch: false,
        supportsCitations: false,
        supportsStructuredOutput: true,
        supportsUsage: true,
      },
    });
    await expect(client.searchCitations('мебельные каталоги')).rejects.toThrow(AISearchConfigError);
  });

  it('runs a search request and returns real citations from annotations', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(perplexitySonarResponse));
    const client = new AISearchClient({
      apiKey: 'sk-test',
      model: 'perplexity/sonar',
      capabilities: CAPABILITIES,
      fetchImpl,
    });

    const citations = await client.searchCitations('мебельные каталоги для бренда мебели', {
      maxResults: 3,
    });

    expect(citations).toHaveLength(3);
    expect(citations[0]?.url).toBe('https://www.maison-objet-exhibitions.com/ru/');
    const request = sentRequest(fetchImpl);
    expect(request.model).toBe('perplexity/sonar');
    expect(request.headers?.Authorization).toBe('Bearer sk-test');
    expect(request.messages?.[0]?.role).toBe('system');
    expect(request.messages?.[1]?.role).toBe('user');
  });

  it('fails loudly when a declared web-search call returns no citations', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ choices: [{ message: { content: 'простой текст без ссылок' } }] }),
      );
    const client = new AISearchClient({
      apiKey: 'key',
      model: 'perplexity/sonar',
      capabilities: CAPABILITIES,
      fetchImpl,
    });
    await expect(client.searchCitations('мебельные каталоги')).rejects.toThrow(
      AISearchNoCitationsError,
    );
  });

  it('maps 401/403 to an auth error without leaking the key', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({}, 401));
    const client = new AISearchClient({
      apiKey: 'sk-secret-value',
      model: 'perplexity/sonar',
      capabilities: CAPABILITIES,
      fetchImpl,
    });
    const error = await client.searchCitations('q').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AISearchClientError);
    const clientError = error as AISearchClientError;
    expect(clientError.category).toBe('auth');
    expect(clientError.message).not.toContain('sk-secret-value');
  });

  it('retries once on 429, then succeeds', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(jsonResponse(perplexitySonarResponse));
    const client = new AISearchClient({
      apiKey: 'key',
      model: 'perplexity/sonar',
      capabilities: CAPABILITIES,
      fetchImpl,
    });
    const citations = await client.searchCitations('q');
    expect(citations.length).toBeGreaterThan(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('surfaces malformed JSON as a response error', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('<html>oops</html>', { status: 200 }));
    const client = new AISearchClient({
      apiKey: 'key',
      model: 'perplexity/sonar',
      capabilities: CAPABILITIES,
      fetchImpl,
    });
    const error = await client.searchCitations('q').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AISearchClientError);
    expect((error as AISearchClientError).category).toBe('response');
  });

  it('returns empty results for a blank query without calling the network', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const client = new AISearchClient({
      apiKey: 'key',
      model: 'perplexity/sonar',
      capabilities: CAPABILITIES,
      fetchImpl,
    });
    await expect(client.searchCitations('   ')).resolves.toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
