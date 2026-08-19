/**
 * Bootstraps the API server state: the Nordhaus scenario runs the real
 * application pipeline up to a mid-flight checkpoint so the UI opens with
 * live content (verified, in-progress, failed, manual and awaiting-approval
 * items). Every step runs through the actual use cases; the user continues
 * the flow from the UI.
 */

import { AISearchClient, OpenCodeAIProvider } from '@aios/ai';
import {
  AIBackedSearchQueryGenerator,
  DeterministicSearchQueryGenerator,
  WebSearchPlatformDiscoverySource,
} from '@aios/application';
import { AISearchCitationsProvider, DuckDuckGoSearchProvider } from '@aios/integrations';
import { HttpPageAnalysisProvider } from '@aios/integrations';

import type { Company, Campaign } from '@aios/domain';

import type { ApiServices } from './app.js';
import {
  NORDHAUS_PLATFORM_IDS,
  approveScenarioOpportunity,
  assessScenarioOpportunity,
  createNordhausEnvironment,
  executeScenarioPlacement,
  prepareScenarioLinkInsert,
  requestManualScenarioPlacement,
  seedNordhausScenario,
  verifyScenarioPlacement,
  type NordhausEnvironment,
  type NordhausEnvironmentOptions,
} from './scenario/nordhaus-environment.js';
import { loadRuntimeConfig, openCodeProviderConfig, type RuntimeConfig } from './runtime-config.js';

export interface NordhausBootstrap extends ApiServices {
  env: NordhausEnvironment;
  company: Company;
  campaign: Campaign;
}

export async function runNordhausBootstrap(
  config: RuntimeConfig = loadRuntimeConfig(),
): Promise<NordhausBootstrap> {
  // The OpenCode provider serves two modes independently: AI_MODE=real (all
  // AI capabilities) and DISCOVERY_MODE=real (search-intent planning). If
  // only discovery is real, the rest of the pipeline stays deterministic.
  const providerConfig = openCodeProviderConfig(config);
  const openCodeProvider = providerConfig !== null ? new OpenCodeAIProvider(providerConfig) : null;

  const envOptions: NordhausEnvironmentOptions = {};
  if (config.aiMode === 'real' && openCodeProvider !== null) {
    envOptions.ai = openCodeProvider;
    // Real mode has no paid SEO metrics source: every metric stays UNKNOWN
    // (honest "no data" instead of synthetic values).
    envOptions.seoMetrics = null;
    envOptions.pageAnalysis = new HttpPageAnalysisProvider({ timeoutMs: 8000 });
  }
  const env = createNordhausEnvironment(envOptions);
  if (config.discoveryMode === 'real') {
    const queryGenerator =
      openCodeProvider !== null
        ? new AIBackedSearchQueryGenerator(openCodeProvider)
        : new DeterministicSearchQueryGenerator();
    const searchProvider =
      config.discoveryProvider === 'ai-search' && config.aiSearch !== null
        ? new AISearchCitationsProvider(
            new AISearchClient({
              apiKey: config.aiSearch.apiKey,
              baseUrl: config.aiSearch.baseUrl,
              model: config.aiSearch.model,
              capabilities: config.aiSearch.capabilities,
              timeoutMs: config.aiSearch.timeoutMs,
            }),
          )
        : new DuckDuckGoSearchProvider();
    env.discoverySources = [
      new WebSearchPlatformDiscoverySource(env.lookups, searchProvider, queryGenerator),
    ];
  }
  const seed = await seedNordhausScenario(env);

  // Assess every seeded opportunity so each carries a donor quality profile,
  // page analysis, risk and Score 2.0 in the UI.
  const seededOpportunities = await env.opportunities.findByCampaignId(seed.campaign.id);
  for (const opportunity of seededOpportunities) {
    await assessScenarioOpportunity(env, opportunity.platformId);
  }

  // Prepare the human-in-the-loop LINK_INSERT showcase on Houzz: donor
  // quality, page analysis, link insert, anchor strategy and outreach draft.
  await prepareScenarioLinkInsert(env, NORDHAUS_PLATFORM_IDS.houzz);

  // Approve the executable + manual opportunities.
  await approveScenarioOpportunity(env, NORDHAUS_PLATFORM_IDS.yandex);
  await approveScenarioOpportunity(env, NORDHAUS_PLATFORM_IDS.twoGis);
  await approveScenarioOpportunity(env, NORDHAUS_PLATFORM_IDS.mebel);
  await approveScenarioOpportunity(env, NORDHAUS_PLATFORM_IDS.archi);
  await approveScenarioOpportunity(env, NORDHAUS_PLATFORM_IDS.inmyroom);

  // Execute: yandex publishes immediately, 2GIS enters the submitted
  // pipeline (the UI demonstrates monitor -> published), archi.ru fails once
  // (failCreate: 1) and waits for a retry from the UI. mebel stays SELECTED
  // so the UI can run "execute".
  const yandex = await executeScenarioPlacement(env, NORDHAUS_PLATFORM_IDS.yandex);
  await executeScenarioPlacement(env, NORDHAUS_PLATFORM_IDS.twoGis);
  await executeScenarioPlacement(env, NORDHAUS_PLATFORM_IDS.archi).catch((error: unknown) => {
    // Expected: the first archi.ru create fails (see createNordhausRegistry).
    void error;
  });

  // Human-in-the-loop: INMYROOM waits for a manual action in the UI.
  await requestManualScenarioPlacement(
    env,
    NORDHAUS_PLATFORM_IDS.inmyroom,
    'Complete the partner application on inmyroom.ru',
  );

  // Yandex is already verified so the Evidence section has real content.
  await verifyScenarioPlacement(env, yandex.id);

  return { env, company: seed.company, campaign: seed.campaign };
}
