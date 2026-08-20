import { describe, expect, it, vi } from 'vitest';

import { OpenCodeAIProvider } from '@aios/ai';
import type { PlacementPlanInput } from '@aios/ai';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const PLAN_INPUT: PlacementPlanInput = {
  campaign: { id: 'c1', name: 'Campaign', goals: ['goal'] },
  company: {
    name: 'Acme',
    industry: 'web',
    description: 'Acme builds sites',
    website: 'https://acme.example.com',
    geography: [],
    products: ['sites'],
    targetAudience: ['owners'],
  },
  companyAnalysis: {
    businessType: 'web agency',
    topics: ['dev'],
    audiences: ['owners'],
    relevantCategories: ['web-development'],
    strategicRecommendations: ['directories'],
  },
  strategy: [
    {
      categoryCode: 'web-development',
      categoryName: 'Веб-разработка',
      placementType: 'DIRECTORY_LISTING',
    },
  ],
  opportunities: [
    {
      opportunityId: 'o1',
      platform: {
        name: 'Catalog',
        url: 'https://catalog.example.com',
        category: 'web-development',
      },
      placementType: 'DIRECTORY_LISTING',
      placementMethod: 'MANUAL',
      status: 'QUALIFIED',
      score: 70,
      overallScore: null,
      donorQuality: null,
      traffic: null,
      riskLevel: null,
      providerAvailable: false,
      providerCapabilitiesVerified: false,
      automationAvailable: false,
      hasIntel: false,
      strategySupportsType: true,
    },
  ],
};

function sentBody(fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>): {
  max_tokens?: unknown;
  response_format?: { type?: string };
} {
  const init = fetchImpl.mock.calls[0]?.[1];
  const body = init?.body;
  return JSON.parse(typeof body === 'string' ? body : '{}') as {
    max_tokens?: unknown;
    response_format?: { type?: string };
  };
}

describe('OpenCodeAIProvider', () => {
  it('applies the plan-specific max_tokens and timeout to placement plan generation', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(() => {
      return Promise.resolve(
        jsonResponse({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({ items: [], overview: 'no opportunities' }),
              },
            },
          ],
        }),
      );
    });
    const provider = new OpenCodeAIProvider({
      apiKey: 'key',
      model: 'm',
      fetchImpl,
      planMaxTokens: 8_000,
      planTimeoutMs: 120_000,
    });

    await provider.generatePlacementPlan(PLAN_INPUT);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sentBody(fetchImpl).max_tokens).toBe(8_000);
    expect(sentBody(fetchImpl).response_format).toEqual({ type: 'json_object' });
  });

  it('does not leak plan limits into other AI tasks', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(() => {
      return Promise.resolve(
        jsonResponse({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  businessType: 'web agency',
                  topics: ['dev'],
                  audiences: ['owners'],
                  relevantCategories: ['web-development'],
                  strategicRecommendations: ['directories'],
                }),
              },
            },
          ],
        }),
      );
    });
    const provider = new OpenCodeAIProvider({
      apiKey: 'key',
      model: 'm',
      fetchImpl,
      planMaxTokens: 8_000,
    });

    await provider.analyzeCompany({
      companyName: 'Acme',
      description: 'Acme builds sites',
      industry: 'web',
      website: 'https://acme.example.com',
      geography: [],
      locations: [],
      products: [],
      targetAudience: [],
      campaignGoals: [],
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sentBody(fetchImpl).max_tokens).toBe(3_000);
  });

  it('omits max_tokens for the plan when planMaxTokens is null', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(() => {
      return Promise.resolve(
        jsonResponse({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({ items: [], overview: null }),
              },
            },
          ],
        }),
      );
    });
    const provider = new OpenCodeAIProvider({
      apiKey: 'key',
      model: 'm',
      fetchImpl,
      planMaxTokens: null,
    });

    await provider.generatePlacementPlan(PLAN_INPUT);

    expect(sentBody(fetchImpl).max_tokens).toBeUndefined();
  });
});
