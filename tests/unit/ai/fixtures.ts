import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Real-format fixture captured from a search-capable AI provider
 * (perplexity/sonar on OpenRouter): message.annotations with url_citation
 * entries. The fixture is a parsing reference for unit tests only — it is
 * never used as runtime discovery data.
 */
export const perplexitySonarResponse: unknown = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/perplexity-sonar-response.json'), 'utf8'),
) as unknown;
