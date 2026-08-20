import { describe, expect, it } from 'vitest';

import {
  loadRuntimeConfig,
  openCodeProviderConfig,
  RuntimeConfigError,
} from '../../../apps/api/src/runtime-config.js';

const DEFAULTS = {
  AI_MODE: undefined as string | undefined,
  DISCOVERY_MODE: undefined as string | undefined,
};

describe('loadRuntimeConfig', () => {
  it('defaults to full demo mode without any env vars', () => {
    const config = loadRuntimeConfig(DEFAULTS);
    expect(config.aiMode).toBe('demo');
    expect(config.discoveryMode).toBe('demo');
    expect(config.openCode).toBeNull();
  });

  it('requires OPENCODE_API_KEY when AI_MODE=real', () => {
    expect(() => loadRuntimeConfig({ ...DEFAULTS, AI_MODE: 'real' })).toThrow(RuntimeConfigError);
    expect(() => loadRuntimeConfig({ ...DEFAULTS, AI_MODE: 'real' })).toThrow(/OPENCODE_API_KEY/);
  });

  it('requires OPENCODE_API_KEY when DISCOVERY_MODE=real', () => {
    expect(() => loadRuntimeConfig({ ...DEFAULTS, DISCOVERY_MODE: 'real' })).toThrow(
      RuntimeConfigError,
    );
  });

  it('resolves the OpenCode config with defaults from env', () => {
    const config = loadRuntimeConfig({
      ...DEFAULTS,
      AI_MODE: 'real',
      OPENCODE_API_KEY: 'sk-test',
    });
    expect(config.aiMode).toBe('real');
    expect(config.openCode).toMatchObject({
      apiKey: 'sk-test',
      baseUrl: 'https://opencode.ai/zen/go/v1',
      model: 'deepseek-v4-pro',
    });
  });

  it('accepts explicit baseUrl/model and trims whitespace', () => {
    const config = loadRuntimeConfig({
      ...DEFAULTS,
      DISCOVERY_MODE: 'real',
      OPENCODE_API_KEY: '  sk-test  ',
      OPENCODE_BASE_URL: ' https://custom.example/v2 ',
      OPENCODE_MODEL: ' kimi-k3 ',
    });
    expect(config.discoveryMode).toBe('real');
    expect(config.openCode?.apiKey).toBe('sk-test');
    expect(config.openCode?.baseUrl).toBe('https://custom.example/v2');
    expect(config.openCode?.model).toBe('kimi-k3');
  });

  it('rejects unknown mode values with a clear message', () => {
    expect(() => loadRuntimeConfig({ ...DEFAULTS, AI_MODE: 'hybrid' })).toThrow(/AI_MODE must be/);
    expect(() => loadRuntimeConfig({ ...DEFAULTS, DISCOVERY_MODE: 'false' })).toThrow(
      /DISCOVERY_MODE must be/,
    );
  });

  it('rejects unknown DISCOVERY_PROVIDER values', () => {
    expect(() => loadRuntimeConfig({ ...DEFAULTS, DISCOVERY_PROVIDER: 'brave' })).toThrow(
      /DISCOVERY_PROVIDER must be/,
    );
  });
});

describe('loadRuntimeConfig with MOCK_PROVIDERS', () => {
  it('denies MOCK providers by default (production-safe)', () => {
    expect(loadRuntimeConfig(DEFAULTS).allowMockProviders).toBe(false);
    expect(loadRuntimeConfig({ ...DEFAULTS, MOCK_PROVIDERS: 'deny' }).allowMockProviders).toBe(
      false,
    );
  });

  it('allows MOCK providers only for explicit "allow"', () => {
    expect(loadRuntimeConfig({ ...DEFAULTS, MOCK_PROVIDERS: 'allow' }).allowMockProviders).toBe(
      true,
    );
    expect(loadRuntimeConfig({ ...DEFAULTS, MOCK_PROVIDERS: ' ALLOW ' }).allowMockProviders).toBe(
      true,
    );
  });

  it('fails startup on unknown values instead of silently allowing mocks', () => {
    expect(() => loadRuntimeConfig({ ...DEFAULTS, MOCK_PROVIDERS: 'true' })).toThrow(
      /MOCK_PROVIDERS must be/,
    );
    expect(() => loadRuntimeConfig({ ...DEFAULTS, MOCK_PROVIDERS: '1' })).toThrow(
      /MOCK_PROVIDERS must be/,
    );
    expect(() => loadRuntimeConfig({ ...DEFAULTS, MOCK_PROVIDERS: 'allow-once' })).toThrow(
      /MOCK_PROVIDERS must be/,
    );
  });
});

describe('loadRuntimeConfig with DISCOVERY_PROVIDER=ai-search', () => {
  const REAL_AI_SEARCH = {
    DISCOVERY_MODE: 'real',
    OPENCODE_API_KEY: 'sk-opencode',
    DISCOVERY_PROVIDER: 'ai-search',
    AI_SEARCH_API_KEY: 'sk-openrouter',
    AI_SEARCH_CAPABILITIES: 'web_search,citations,usage',
  } as const;

  it('loads ai-search config only when DISCOVERY_PROVIDER=ai-search', () => {
    const config = loadRuntimeConfig(REAL_AI_SEARCH);
    expect(config.discoveryProvider).toBe('ai-search');
    expect(config.aiSearch).toMatchObject({
      apiKey: 'sk-openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'perplexity/sonar',
      timeoutMs: 45000,
    });
    expect(config.aiSearch?.capabilities).toMatchObject({
      supportsWebSearch: true,
      supportsCitations: true,
      supportsUsage: true,
    });
    // The duckduckgo default must not silently pick up ai-search credentials.
    const duck = loadRuntimeConfig({
      DISCOVERY_MODE: 'real',
      OPENCODE_API_KEY: 'sk-opencode',
    });
    expect(duck.discoveryProvider).toBe('duckduckgo');
    expect(duck.aiSearch).toBeNull();
  });

  it('fails fast when AI_SEARCH_API_KEY is missing (OpenCode key is not a search key)', () => {
    expect(() =>
      loadRuntimeConfig({
        DISCOVERY_MODE: 'real',
        OPENCODE_API_KEY: 'sk-opencode',
        DISCOVERY_PROVIDER: 'ai-search',
        AI_SEARCH_CAPABILITIES: 'web_search,citations',
      }),
    ).toThrow(/AI_SEARCH_API_KEY/);
    expect(() =>
      loadRuntimeConfig({
        DISCOVERY_MODE: 'real',
        OPENCODE_API_KEY: 'sk-opencode',
        DISCOVERY_PROVIDER: 'ai-search',
        AI_SEARCH_CAPABILITIES: 'web_search,citations',
      }),
    ).toThrow(/OpenCode Go key/);
  });

  it('fails fast when capabilities are not declared', () => {
    expect(() =>
      loadRuntimeConfig({
        DISCOVERY_MODE: 'real',
        OPENCODE_API_KEY: 'sk-opencode',
        DISCOVERY_PROVIDER: 'ai-search',
        AI_SEARCH_API_KEY: 'sk-openrouter',
      }),
    ).toThrow(/AI_SEARCH_CAPABILITIES to declare/);
  });

  it('fails fast when capabilities do not include web search/citations', () => {
    expect(() =>
      loadRuntimeConfig({
        DISCOVERY_MODE: 'real',
        OPENCODE_API_KEY: 'sk-opencode',
        DISCOVERY_PROVIDER: 'ai-search',
        AI_SEARCH_API_KEY: 'sk-openrouter',
        AI_SEARCH_CAPABILITIES: 'usage',
      }),
    ).toThrow(/include "web_search" and "citations"/);
  });

  it('accepts an explicit search baseUrl/model', () => {
    const config = loadRuntimeConfig({
      ...REAL_AI_SEARCH,
      AI_SEARCH_BASE_URL: 'https://custom.example/v1',
      AI_SEARCH_MODEL: 'perplexity/sonar-pro',
    });
    expect(config.aiSearch?.baseUrl).toBe('https://custom.example/v1');
    expect(config.aiSearch?.model).toBe('perplexity/sonar-pro');
  });

  it('does not load ai-search config in demo discovery mode', () => {
    const config = loadRuntimeConfig({
      DISCOVERY_PROVIDER: 'ai-search',
      AI_SEARCH_API_KEY: 'sk-openrouter',
    });
    expect(config.discoveryMode).toBe('demo');
    expect(config.aiSearch).toBeNull();
  });
});

describe('openCodeProviderConfig', () => {
  it('returns null for demo configs', () => {
    expect(openCodeProviderConfig(loadRuntimeConfig(DEFAULTS))).toBeNull();
  });

  it('builds a client config with a sane timeout', () => {
    const config = loadRuntimeConfig({ ...DEFAULTS, AI_MODE: 'real', OPENCODE_API_KEY: 'k' });
    const providerConfig = openCodeProviderConfig(config);
    expect(providerConfig?.apiKey).toBe('k');
    expect(providerConfig?.timeoutMs).toBe(30000);
  });

  it('defaults the placement plan limits to 8000 tokens and 120s', () => {
    const config = loadRuntimeConfig({ ...DEFAULTS, AI_MODE: 'real', OPENCODE_API_KEY: 'k' });
    const providerConfig = openCodeProviderConfig(config);
    expect(providerConfig?.planMaxTokens).toBe(8000);
    expect(providerConfig?.planTimeoutMs).toBe(120000);
  });

  it('reads placement plan limits from the environment', () => {
    const config = loadRuntimeConfig({ ...DEFAULTS, AI_MODE: 'real', OPENCODE_API_KEY: 'k' });
    const providerConfig = openCodeProviderConfig(config, {
      ...process.env,
      OPENCODE_PLAN_MAX_TOKENS: '16000',
      OPENCODE_PLAN_TIMEOUT_MS: '180000',
    });
    expect(providerConfig?.planMaxTokens).toBe(16000);
    expect(providerConfig?.planTimeoutMs).toBe(180000);
  });

  it('supports disabling the plan token cap via "0"', () => {
    const config = loadRuntimeConfig({ ...DEFAULTS, AI_MODE: 'real', OPENCODE_API_KEY: 'k' });
    const providerConfig = openCodeProviderConfig(config, {
      ...process.env,
      OPENCODE_PLAN_MAX_TOKENS: '0',
    });
    expect(providerConfig?.planMaxTokens).toBeNull();
  });

  it('rejects invalid plan limit values with the defaults', () => {
    const config = loadRuntimeConfig({ ...DEFAULTS, AI_MODE: 'real', OPENCODE_API_KEY: 'k' });
    const providerConfig = openCodeProviderConfig(config, {
      ...process.env,
      OPENCODE_PLAN_MAX_TOKENS: 'abc',
      OPENCODE_PLAN_TIMEOUT_MS: '-5',
    });
    expect(providerConfig?.planMaxTokens).toBe(8000);
    expect(providerConfig?.planTimeoutMs).toBe(120000);
  });
});
