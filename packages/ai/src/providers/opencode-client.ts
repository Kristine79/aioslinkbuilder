/**
 * Minimal OpenAI-compatible chat completions client for OpenCode Go.
 *
 * Security: the API key is accepted only via constructor/config and is never
 * logged, never included in error messages and never leaked into request
 * payloads beyond the Authorization header. Errors carry status/category only.
 *
 * Reliability (cost/rate-limit protection):
 * - per-request timeout (default 30s)
 * - max 2 retries with exponential backoff (only for 429/5xx/network/timeout)
 * - no retries on 401/400 (auth/validation errors are not transient)
 * - JSON extraction tolerates markdown fences around the JSON payload
 */

import { defaultOpenCodeBaseUrl, OpenCodeModelConfigError } from './opencode-errors.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 800;

export interface OpenCodeClientConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenCodeClientOptions {
  timeoutMs: number;
  /** Attempted once per transport call, increments transport-level retries. */
  attempt: number;
}

export class OpenCodeClientError extends Error {
  constructor(
    readonly category:
      'timeout' | 'network' | 'auth' | 'rate-limit' | 'server' | 'validation' | 'response',
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'OpenCodeClientError';
  }
}

export class OpenCodeClient {
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OpenCodeClientConfig) {
    if (config.apiKey.trim() === '') {
      throw new OpenCodeModelConfigError('OPENCODE_API_KEY is required to construct the client');
    }
    this.apiKey = config.apiKey.trim();
    this.baseUrl = (config.baseUrl ?? defaultOpenCodeBaseUrl).trim().replace(/\/+$/, '');
    this.model = (config.model ?? '').trim();
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = config.fetchImpl ?? ((...args) => fetch(...args));
  }

  /**
   * Calls chat completions with retry/backoff. Returns the parsed JSON from
   * the assistant message content. Throws OpenCodeClientError on transport
   * or response failures; the caller maps it to application errors.
   */
  async chat(messages: ChatMessage[], options?: { jsonMode?: boolean }): Promise<unknown> {
    if (this.model === '') {
      throw new OpenCodeModelConfigError('OPENCODE_MODEL is required to call OpenCode Go');
    }
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: 0.2,
      max_tokens: 3_000,
    };
    if (options?.jsonMode === true) {
      body.response_format = { type: 'json_object' };
    }

    let lastError: OpenCodeClientError | null = null;
    let correctiveApplied = false;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      if (attempt > 0 && lastError !== null) {
        await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
      }
      const corrective: ChatMessage[] = correctiveApplied
        ? [
            {
              role: 'system',
              content:
                'Your previous answer was not valid JSON. Reply again with ONLY a valid JSON object — no prose, no markdown fences, no trailing text.',
            },
          ]
        : [];
      try {
        return await this.completeOnce({ ...body, messages: [...messages, ...corrective] });
      } catch (error) {
        if (!(error instanceof OpenCodeClientError)) {
          throw error;
        }
        if (error.category === 'response') {
          // Malformed JSON content: exactly one corrective retry telling the
          // model to respond with pure JSON only. Not counted as a transport
          // retry; a second malformed response is a hard error.
          if (!correctiveApplied) {
            correctiveApplied = true;
            lastError = error;
            continue;
          }
          throw error;
        }
        if (!isRetryable(error) || attempt >= MAX_RETRIES) {
          throw error;
        }
        lastError = error;
      }
    }
    if (lastError !== null) throw lastError;
    throw new OpenCodeClientError('response', 'OpenCode Go returned no response', null);
  }

  private async completeOnce(body: Record<string, unknown>): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new OpenCodeClientError(
          'timeout',
          `OpenCode Go request timed out after ${this.timeoutMs}ms`,
          null,
        );
      }
      throw new OpenCodeClientError(
        'network',
        'OpenCode Go network error while calling chat completions',
        null,
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new OpenCodeClientError(
        'auth',
        'OpenCode Go rejected the API key (HTTP 401/403)',
        response.status,
      );
    }
    if (response.status === 429) {
      throw new OpenCodeClientError(
        'rate-limit',
        'OpenCode Go rate limit exceeded (429)',
        response.status,
      );
    }
    if (response.status >= 500) {
      throw new OpenCodeClientError(
        'server',
        `OpenCode Go server error (HTTP ${response.status})`,
        response.status,
      );
    }
    if (response.status >= 400 && response.status < 500) {
      throw new OpenCodeClientError(
        'validation',
        `OpenCode Go rejected the request (HTTP ${response.status}) — check OPENCODE_MODEL and the payload`,
        response.status,
      );
    }
    if (!response.ok) {
      throw new OpenCodeClientError(
        'response',
        `OpenCode Go rejected the request (HTTP ${response.status})`,
        response.status,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new OpenCodeClientError(
        'response',
        'OpenCode Go returned malformed JSON envelope',
        response.status,
      );
    }
    const content = extractAssistantContent(payload);
    if (content === null) {
      throw new OpenCodeClientError(
        'response',
        'OpenCode Go response had no assistant content',
        response.status,
      );
    }
    const parsed = extractJson(content);
    if (parsed === undefined) {
      throw new OpenCodeClientError(
        'response',
        'OpenCode Go returned unparseable JSON content',
        response.status,
      );
    }
    return parsed;
  }
}

function extractAssistantContent(payload: unknown): string | null {
  if (payload === null || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const choices = record.choices as unknown[];
  if (choices.length === 0) return null;
  const first = choices[0];
  if (first === null || typeof first !== 'object') return null;
  const message = (first as Record<string, unknown>).message;
  if (message === null || typeof message !== 'object') return null;
  const content = (message as Record<string, unknown>).content;
  return typeof content === 'string' && content.trim() !== '' ? content : null;
}

function extractJson(content: string): unknown {
  const trimmed = content.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  const candidate = fenced === null ? trimmed : (fenced[1] ?? trimmed);
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

function isRetryable(error: OpenCodeClientError): boolean {
  return (
    error.category === 'rate-limit' ||
    error.category === 'server' ||
    error.category === 'network' ||
    error.category === 'timeout'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
