import { describe, expect, it, vi } from 'vitest';

import { OpenCodeClient, OpenCodeClientError } from '@aios/ai';
import { OpenCodeModelConfigError } from '@aios/ai';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function assistantEnvelope(content: string): Response {
  return jsonResponse({ choices: [{ message: { role: 'assistant', content } }] });
}

interface SentRequest {
  model?: string;
  response_format?: { type?: string };
  messages?: Array<{ role: string; content: string }>;
  headers?: Record<string, string>;
}

/** Extracts the payload sent to the fake fetch endpoint for assertion. */
function sentRequest(
  fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>,
  callIndex = 0,
): SentRequest {
  const init = fetchImpl.mock.calls[callIndex]?.[1];
  const body = init?.body;
  const parsed = JSON.parse(typeof body === 'string' ? body : '{}') as SentRequest;
  return { ...parsed, headers: (init?.headers ?? {}) as Record<string, string> };
}

describe('OpenCodeClient', () => {
  it('rejects an empty API key at construction', () => {
    expect(() => new OpenCodeClient({ apiKey: '   ' })).toThrow(OpenCodeModelConfigError);
  });

  it('rejects calls without a configured model', async () => {
    const client = new OpenCodeClient({ apiKey: 'key', model: '' });
    await expect(client.chat([{ role: 'user', content: 'hi' }])).rejects.toThrow(
      OpenCodeModelConfigError,
    );
  });

  it('parses the JSON from a successful chat completion', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(assistantEnvelope('{"intents":[{"intent":"a","queries":["q"]}]}'));
    const client = new OpenCodeClient({ apiKey: 'key', model: 'm', fetchImpl });
    const result = await client.chat([{ role: 'user', content: 'plan' }], { jsonMode: true });

    expect(result).toEqual({ intents: [{ intent: 'a', queries: ['q'] }] });
    const request = sentRequest(fetchImpl);
    expect(request.model).toBe('m');
    expect(request.response_format).toEqual({ type: 'json_object' });
    expect(request.headers?.Authorization).toBe('Bearer key');
  });

  it('tolerates markdown fences around the JSON payload', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(assistantEnvelope('```json\n{"ok":true}\n```'));
    const client = new OpenCodeClient({ apiKey: 'key', model: 'm', fetchImpl });
    await expect(client.chat([{ role: 'user', content: 'x' }])).resolves.toEqual({ ok: true });
  });

  it('corrects malformed JSON once, then succeeds', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(assistantEnvelope('I am sorry, no data available right now'))
      .mockResolvedValueOnce(assistantEnvelope('{"a":1}'));
    const client = new OpenCodeClient({ apiKey: 'key', model: 'm', fetchImpl });
    await expect(
      client.chat([{ role: 'user', content: 'x' }], { jsonMode: true }),
    ).resolves.toEqual({
      a: 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const secondCall = sentRequest(fetchImpl, 1);
    expect(secondCall.messages?.at(-1)?.role).toBe('system');
  });

  it('throws after two consecutive malformed responses (no infinite retry)', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(assistantEnvelope('not json at all'));
    const client = new OpenCodeClient({ apiKey: 'key', model: 'm', fetchImpl });
    await expect(client.chat([{ role: 'user', content: 'x' }])).rejects.toMatchObject({
      category: 'response',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('maps 401 to an auth error without retrying or leaking the key', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: 'invalid key' }, 401));
    const client = new OpenCodeClient({ apiKey: 'sk-super-secret-value', model: 'm', fetchImpl });
    const error = await client
      .chat([{ role: 'user', content: 'x' }])
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(OpenCodeClientError);
    expect((error as OpenCodeClientError).category).toBe('auth');
    expect((error as OpenCodeClientError).message).not.toContain('sk-super-secret-value');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries a rate-limit response once and succeeds', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(assistantEnvelope('{"ok":true}'));
    const client = new OpenCodeClient({ apiKey: 'key', model: 'm', fetchImpl });
    await expect(client.chat([{ role: 'user', content: 'x' }])).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('gives up after MAX_RETRIES on server errors', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 503));
    const client = new OpenCodeClient({ apiKey: 'key', model: 'm', fetchImpl });
    await expect(client.chat([{ role: 'user', content: 'x' }])).rejects.toMatchObject({
      category: 'server',
      status: 503,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('maps network failures to a network error and retries', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(assistantEnvelope('{"ok":true}'));
    const client = new OpenCodeClient({ apiKey: 'key', model: 'm', fetchImpl });
    await expect(client.chat([{ role: 'user', content: 'x' }])).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('maps 400 to a validation error (not retried, no corrective)', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 400));
    const client = new OpenCodeClient({ apiKey: 'key', model: 'm', fetchImpl });
    await expect(client.chat([{ role: 'user', content: 'x' }])).rejects.toMatchObject({
      category: 'validation',
      status: 400,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws a response error when the envelope has no assistant content', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ choices: [] }));
    const client = new OpenCodeClient({ apiKey: 'key', model: 'm', fetchImpl });
    await expect(client.chat([{ role: 'user', content: 'x' }])).rejects.toMatchObject({
      category: 'response',
    });
  });
});
