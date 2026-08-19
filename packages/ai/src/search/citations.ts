/**
 * Extracts real web citations from an OpenAI-compatible chat completion.
 *
 * Search-capable providers (perplexity/* on OpenRouter) attach the sources
 * they actually used as message.annotations[{ type: "url_citation",
 * url_citation: { url, title, start_index, end_index } }]. Only these
 * structured citations become WebSearchResults — free-form LLM prose is never
 * interpreted as discovered sites.
 */

import type { AiCitation } from './types.js';

export interface CitationExtractionResult {
  content: string;
  citations: AiCitation[];
}

/**
 * Extracts the assistant content and validated citations from a raw chat
 * completion payload. Citations with non-http(s) URLs or empty else schemes
 * are dropped; an assistant message without annotations yields an empty list.
 */
export function extractCitations(payload: unknown): CitationExtractionResult {
  const message = assistantMessage(payload);
  if (message === null) {
    return { content: '', citations: [] };
  }

  const content = typeof message.content === 'string' ? message.content.trim() : '';
  const citations = extractCitationAnnotations(message.annotations);

  return { content, citations };
}

function assistantMessage(payload: unknown): {
  content: unknown;
  annotations: unknown;
} | null {
  if (payload === null || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const choices = record.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0] as unknown;
  if (first === null || typeof first !== 'object') return null;
  const message = (first as Record<string, unknown>).message;
  if (message === null || typeof message !== 'object') return null;
  const messageRecord = message as Record<string, unknown>;
  return {
    content: messageRecord.content,
    annotations: messageRecord.annotations,
  };
}

function extractCitationAnnotations(annotations: unknown): AiCitation[] {
  if (!Array.isArray(annotations)) return [];

  const citations: AiCitation[] = [];
  for (const annotation of annotations) {
    if (annotation === null || typeof annotation !== 'object') continue;
    const record = annotation as Record<string, unknown>;
    if (record.type !== 'url_citation') continue;

    const raw =
      record.url_citation !== null &&
      typeof record.url_citation === 'object' &&
      !Array.isArray(record.url_citation)
        ? (record.url_citation as Record<string, unknown>)
        : record;

    const url = typeof raw.url === 'string' ? raw.url.trim() : '';
    if (!isHttpUrl(url)) continue;

    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    const startIndex = typeof raw.start_index === 'number' ? raw.start_index : null;
    const endIndex = typeof raw.end_index === 'number' ? raw.end_index : null;

    citations.push({
      url,
      title: title === '' ? null : title,
      startIndex,
      endIndex,
    });
  }
  return citations;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
