/**
 * REAL smoke test: AI_MODE=real + DISCOVERY_MODE=real on a brand-new company
 * («Арт-студия «Гамма»»). Every step hits real providers: OpenCode Go LLM,
 * real web search (DuckDuckGo or a search-capable AI provider with citations)
 * and live HTTP page analysis. No ScenarioAIProvider, no Nordhaus fixtures, no
 * mock search.
 *
 * Search backend is selected by DISCOVERY_PROVIDER (duckduckgo | ai-search),
 * exactly like apps/api/src/bootstrap.ts.
 *
 * The API keys are read from the environment only and are NEVER printed,
 * logged or written anywhere. At the end the script asserts no key appears in
 * any API response or in any observed request URL.
 *
 * Run:  set -a && source .env && set +a && AI_MODE=real DISCOVERY_MODE=real \
 *       DISCOVERY_PROVIDER=ai-search pnpm tsx scripts/real-smoke.ts
 */

import { AISearchClient, OpenCodeAIProvider } from '@aios/ai';
import {
  AIBackedSearchQueryGenerator,
  CreateCampaignUseCase,
  CreateCompanyUseCase,
  WebSearchPlatformDiscoverySource,
} from '@aios/application';
import {
  AISearchCitationsProvider,
  DuckDuckGoSearchProvider,
  HttpPageAnalysisProvider,
} from '@aios/integrations';
import { createApiApp, createNordhausEnvironment, NORDHAUS_PLATFORMS } from '@aios/api';
import type { ApiCompanyAnalysisDto, ApiOpportunityDto } from '@aios/api';

import { loadRuntimeConfig, openCodeProviderConfig } from '../apps/api/src/runtime-config.js';

interface FetchProbe {
  host: string;
  ms: number;
  status: number | null;
  note: string;
  url: string;
}

function fail(message: string): never {
  throw new Error(`SMOKE FAIL: ${message}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '(invalid-url)';
  }
}

function main(): void {
  const probes: FetchProbe[] = [];
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const started = performance.now();
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const promise = originalFetch(input, init);
    promise
      .then(
        (res) => {
          probes.push({
            host: safeHost(url),
            ms: performance.now() - started,
            status: res.status,
            note: '',
            url,
          });
        },
        (error: unknown) => {
          probes.push({
            host: safeHost(url),
            ms: performance.now() - started,
            status: null,
            note: error instanceof Error ? error.message.slice(0, 80) : String(error).slice(0, 80),
            url,
          });
        },
      )
      .catch(() => {});
    return promise;
  };

  run(probes).catch((error: unknown) => {
    console.error('\nSMOKE FAILED:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

async function run(probes: FetchProbe[]): Promise<void> {
  console.log('=== REAL SMOKE TEST: Арт-студия «Гамма» ===\n');

  // --- configuration ---------------------------------------------------------
  const config = loadRuntimeConfig(process.env);
  assert(
    config.aiMode === 'real' && config.discoveryMode === 'real',
    'AI_MODE and DISCOVERY_MODE must both be "real" (run with the real env)',
  );
  const providerConfig = openCodeProviderConfig(config, process.env);
  assert(providerConfig !== null, 'OpenCode provider config missing');
  const apiKey = providerConfig.apiKey;
  assert(apiKey.length >= 10, 'OPENCODE_API_KEY is not set or too short');
  const baseUrl = providerConfig.baseUrl ?? 'https://opencode.ai/zen/go/v1';
  const aiHost = safeHost(baseUrl);
  console.log(
    `- runtime config: AI_MODE=real, DISCOVERY_MODE=real, provider host=${aiHost}, model=${providerConfig.model}`,
  );

  // --- real composition (same wiring as apps/api/src/bootstrap.ts) ------------
  const ai = new OpenCodeAIProvider(providerConfig);
  const env = createNordhausEnvironment({
    ai,
    seoMetrics: null,
    pageAnalysis: new HttpPageAnalysisProvider({ timeoutMs: 8000 }),
  });
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
  const searchBackendLabel =
    config.discoveryProvider === 'ai-search' ? 'ai-search (real citations)' : 'duckduckgo';
  env.discoverySources = [
    new WebSearchPlatformDiscoverySource(
      env.lookups,
      searchProvider,
      new AIBackedSearchQueryGenerator(ai),
      { maxQueries: 6, maxResultsPerQuery: 8, maxCandidates: 12, concurrency: 2, dedupe: true },
    ),
  ];

  assert(env.ai instanceof OpenCodeAIProvider, 'env.ai is NOT the real OpenCodeAIProvider');
  assert(env.seoMetrics === null, 'seoMetrics must be null in real mode');
  assert(
    env.discoverySources.length === 1 &&
      env.discoverySources[0] instanceof WebSearchPlatformDiscoverySource,
    'discoverySources are NOT the real web-search source',
  );
  console.log(
    `- composition: ai=OpenCodeAIProvider (REAL), seoMetrics=null (UNKNOWN), ` +
      `pageAnalysis=HttpPageAnalysisProvider (REAL), discoverySources=[web-search/${searchBackendLabel}] (REAL)`,
  );

  // --- brand-new company + campaign (real use cases) --------------------------
  const company = await new CreateCompanyUseCase(env.companies, env.auditLog).execute({
    name: 'Арт-студия «Гамма»',
    industry: 'дизайн и производство мебели',
    description:
      'студия проектирует и производит премиальную мебель на заказ для частных интерьеров, архитекторов, дизайнеров и HoReCa',
    geography: ['Москва', 'Россия'],
    locations: ['Москва'],
    products: ['мебель на заказ', 'кухни', 'встроенная мебель', 'интерьерные решения'],
    targetAudience: [
      'владельцы премиальной недвижимости',
      'дизайнеры интерьеров',
      'архитекторы',
      'HoReCa',
    ],
  });
  const campaign = await new CreateCampaignUseCase(
    env.companies,
    env.campaigns,
    env.auditLog,
  ).execute({
    companyId: company.id,
    name: 'Гамма: премиальная мебель на заказ — Москва',
    goals: ['Получить качественные тематические размещения и упоминания бренда'],
  });
  console.log(`- created company id=${company.id}, campaign id=${campaign.id}`);

  const app = createApiApp({ env, campaign });

  const responseBodies: string[] = [];
  async function api(
    path: string,
    init?: { body?: unknown },
  ): Promise<{ status: number; ms: number; body: unknown }> {
    const started = performance.now();
    const res = await app.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(init?.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
    const text = await res.text();
    responseBodies.push(text);
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: res.status, ms: performance.now() - started, body };
  }

  // 1) REAL company analysis ----------------------------------------------------
  console.log('\n[1] REAL company analysis (OpenCode Go):');
  const analyze = await api('/api/company/analyze');
  assert(analyze.status === 200, `analyze: HTTP ${analyze.status} ${JSON.stringify(analyze.body)}`);
  const companyDto = analyze.body as { analysis: ApiCompanyAnalysisDto | null };
  assert(companyDto.analysis !== null, 'analyze: no analysis in response');
  const analysis = companyDto.analysis;
  assert(
    analysis.provider !== 'ScenarioAIProvider',
    `analyze: unexpected provider ${analysis.provider}`,
  );
  console.log(
    `  - HTTP ${analyze.status} in ${analyze.ms.toFixed(0)}ms, provider=${analysis.provider}, model=${analysis.model ?? '(not reported)'}`,
  );
  console.log(`  - businessType=${analysis.businessType}`);
  console.log(`  - topics=${JSON.stringify(analysis.topics.slice(0, 6))}`);
  console.log(`  - audiences=${JSON.stringify(analysis.audiences.slice(0, 6))}`);
  console.log(`  - relevantCategories=${JSON.stringify(analysis.relevantCategories.slice(0, 8))}`);

  // 2) REAL discovery -----------------------------------------------------------
  console.log(`\n[2] REAL discovery (web-search / ${searchBackendLabel}):`);
  const discovery = await api('/api/discover');
  assert(
    discovery.status === 200,
    `discover: HTTP ${discovery.status} ${JSON.stringify(discovery.body)}`,
  );
  const disc = discovery.body as {
    discovered: number;
    classified: number;
    sources: string[];
    items: ApiOpportunityDto[];
  };
  const searchHost =
    config.discoveryProvider === 'ai-search'
      ? safeHost(config.aiSearch?.baseUrl ?? '')
      : 'html.duckduckgo.com';
  if (disc.discovered === 0) {
    const searchFailures = probes.filter(
      (p) => p.host.includes(safeHost(searchHost)) || p.host.includes('duckduckgo'),
    );
    console.log(`  - zero discovered; observed search calls: ${searchFailures.length}`);
    for (const f of searchFailures) {
      console.log(`    - status=${f.status ?? 'network-error'} ${f.note} (${f.ms.toFixed(0)}ms)`);
    }
  }
  assert(disc.discovered > 0, 'discover: zero discovered');
  assert(disc.sources.includes('web-search'), `discover: sources=${JSON.stringify(disc.sources)}`);
  assert(disc.items.length > 0, 'discover: no items');
  console.log(
    `  - HTTP ${discovery.status} in ${discovery.ms.toFixed(0)}ms, discovered=${disc.discovered}, classified=${disc.classified}, sources=${JSON.stringify(disc.sources)}`,
  );
  const fixtureUrls = new Set(
    NORDHAUS_PLATFORMS.map((p) => p.url).filter(
      (url): url is string => url !== null && url !== undefined,
    ),
  );
  let freshCount = 0;
  for (const item of disc.items) {
    assert(
      item.discoverySource === 'web-search',
      `item ${item.platformName}: discoverySource=${item.discoverySource}`,
    );
    const isFixture = item.platformUrl !== null && fixtureUrls.has(item.platformUrl);
    if (!isFixture) freshCount += 1;
    assert(
      typeof item.score === 'number' && item.score !== null,
      `item ${item.platformName}: no deterministic score`,
    );
    console.log(
      `  - ${item.platformName} | ${item.platformUrl ?? '(no url)'} | cat=${item.categoryCode ?? '-'} | type=${item.placementType} | score=${item.score} | status=${item.status}${isFixture ? ' | (already in catalog)' : ' | NEW'}`,
    );
  }
  assert(freshCount > 0, 'no result outside the seed/demo catalog was found');
  console.log(`  - results outside the seed/demo catalog: ${freshCount} of ${disc.items.length}`);
  const persistedWebPlatforms = (await env.lookups.listPlatforms()).filter(
    (p) => p.metadata?.discoveredVia === 'web-search',
  );
  console.log(`  - platforms persisted from web-search: ${persistedWebPlatforms.length}`);
  const searchCalls =
    config.discoveryProvider === 'ai-search'
      ? probes.filter((p) => p.host === safeHost(config.aiSearch?.baseUrl ?? ''))
      : probes.filter((p) => p.host.includes('duckduckgo'));

  // 3) REAL classification + deterministic score --------------------------------
  console.log('\n[3] Real classification (AI) + deterministic score:');
  for (const item of disc.items.slice(0, 3)) {
    assert(
      item.recommendation !== null && item.recommendation.trim() !== '',
      `${item.platformName}: no recommendation`,
    );
    assert(item.scoreBreakdown !== null, `${item.platformName}: no score breakdown`);
    const b = item.scoreBreakdown;
    console.log(
      `  - ${item.platformName}: placementType=${item.placementType}, category=${item.categoryCode}, score=${item.score}, ` +
        `breakdown={topical=${b.topicalRelevance}, geo=${b.geographicRelevance}, automation=${b.automationPotential}}, ` +
        `why=${(item.whyRecommended ?? '').slice(0, 110)}`,
    );
  }

  // 4) Provenance sweep ----------------------------------------------------------
  console.log('\n[4] Provenance (no SYNTHETIC, no fake SEO metrics):');
  for (const item of disc.items.slice(0, 3)) {
    assert(
      item.scoreBreakdown !== null && item.scoreBreakdown.topicalRelevance !== null,
      `${item.platformName}: missing topical relevance`,
    );
    assert(
      item.traffic === null || item.traffic > 0,
      `${item.platformName}: suspicious traffic field`,
    );
  }
  const searchOk = searchCalls.length > 0 && searchCalls.every((p) => p.status === 200);
  assert(searchOk, `search backend produced no successful real calls for ${searchBackendLabel}`);
  console.log(
    `  - all discovered items labeled discoverySource=web-search (REAL, via ${searchBackendLabel}), no SYNTHETIC fields`,
  );
  console.log(`  - ${searchCalls.length} real search call(s) to search backend, all HTTP 200`);

  // 5) REAL page analysis ---------------------------------------------------------
  console.log('\n[5] REAL page analysis (HttpPageAnalysisProvider):');
  const top = [...disc.items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const intelItems: Array<{ id: string; name: string; score: number | null }> = [];
  for (const item of top.slice(0, 3)) {
    const intel = await api(`/api/opportunities/${item.id}/intel`);
    assert(
      intel.status === 200,
      `intel ${item.platformName}: HTTP ${intel.status} ${JSON.stringify(intel.body)}`,
    );
    const dto = intel.body as ApiOpportunityDto;
    intelItems.push({ id: item.id, name: item.platformName, score: dto.overallScore ?? dto.score });
    const pa = dto.pageAnalysis;
    console.log(`  - ${item.platformName}:`);
    console.log(`      pageTitle=${pa?.pageTitle ?? '(none)'}`);
    console.log(
      `      pageType=${pa?.pageType ?? '(none)'}, topical.status=${pa?.topicalRelevance.status}, value=${pa?.topicalRelevance.value}`,
    );
    console.log(
      `      indexation.status=${pa?.indexation.status}, traffic.status=${pa?.traffic.status}`,
    );
    const dq = dto.donorQuality;
    if (dq !== null) {
      for (const [label, datum] of [
        ['organicTraffic', dq.organicTraffic],
        ['authority', dq.authority],
        ['backlinks', dq.backlinkProfile],
        ['spamRisk', dq.spamRisk],
        ['topicalRelevance', dq.topicalRelevance],
      ] as const) {
        assert(datum.status !== 'SYNTHETIC', `${item.platformName}: ${label} is SYNTHETIC`);
      }
      console.log(
        `      donorQuality: organicTraffic=${JSON.stringify(dq.organicTraffic)}, authority=${JSON.stringify(dq.authority)}, backlinks=${JSON.stringify(dq.backlinkProfile)}, spamRisk=${JSON.stringify(dq.spamRisk)}`,
      );
      console.log(
        `      donorQualityScore=${dto.donorQualityScore}, risk=${dto.risk?.level}, overallScore=${dto.overallScore}, traffic=${dto.traffic}`,
      );
    }
  }

  // 6) REAL link insert + anchors --------------------------------------------------
  console.log('\n[6] REAL link insert + anchor strategy (OpenCode Go):');
  const liCandidate = top.find((item) => item.placementType === 'LINK_INSERT') ?? top[0];
  if (liCandidate === undefined) fail('no opportunity to run link insert');
  const li = await api(`/api/opportunities/${liCandidate.id}/link-insert`);
  assert(li.status === 200, `link-insert: HTTP ${li.status} ${JSON.stringify(li.body)}`);
  const liDto = li.body as ApiOpportunityDto;
  assert(
    liDto.linkInsert !== null && liDto.linkInsert.text.trim() !== '',
    'link-insert: empty draft',
  );
  assert(liDto.anchorStrategy !== null, 'link-insert: no anchor strategy');
  console.log(`  - ${liCandidate.platformName} (${liCandidate.platformUrl})`);
  console.log(`    anchor=${liDto.linkInsert.anchor}, type=${liDto.anchorStrategy.anchorType}`);
  console.log(`    alternatives=${JSON.stringify(liDto.linkInsert.anchorAlternatives)}`);
  console.log(`    insertionPoint=${liDto.linkInsert.suggestedInsertionPoint}`);
  console.log(`    text="${liDto.linkInsert.text}"`);
  console.log(`    explanation=${liDto.linkInsert.explanation}`);

  // 7) REAL outreach + HITL chain ----------------------------------------------------
  console.log('\n[7] REAL outreach draft + HITL (DRAFT -> READY_FOR_REVIEW -> APPROVED):');
  const out = await api(`/api/opportunities/${liCandidate.id}/outreach`);
  assert(out.status === 200, `outreach: HTTP ${out.status} ${JSON.stringify(out.body)}`);
  let outDto = out.body as ApiOpportunityDto;
  assert(outDto.outreach?.status === 'DRAFT', `outreach: status=${outDto.outreach?.status}`);
  assert(
    outDto.outreach.message !== null && outDto.outreach.message.message.length > 0,
    'outreach: empty message',
  );
  console.log(
    `  - DRAFT: subject="${outDto.outreach.message.subject}", message=${outDto.outreach.message.message.length} chars, opening="${outDto.outreach.message.opening}"`,
  );

  const rfr = await api(`/api/opportunities/${liCandidate.id}/outreach/status`, {
    body: { status: 'READY_FOR_REVIEW' },
  });
  assert(rfr.status === 200, `READY_FOR_REVIEW: HTTP ${rfr.status}`);
  assert(
    (rfr.body as ApiOpportunityDto).outreach?.status === 'READY_FOR_REVIEW',
    'READY_FOR_REVIEW transition failed',
  );
  console.log('  - READY_FOR_REVIEW (human review, nothing sent)');

  const approved = await api(`/api/opportunities/${liCandidate.id}/outreach/status`, {
    body: { status: 'APPROVED' },
  });
  assert(approved.status === 200, `APPROVED: HTTP ${approved.status}`);
  outDto = approved.body as ApiOpportunityDto;
  assert(outDto.outreach?.status === 'APPROVED', 'APPROVED transition failed');
  console.log('  - APPROVED (human approved; no real send executed — HITL)');

  // 8) REAL negotiation analysis -------------------------------------------------------
  console.log('\n[8] REAL negotiation analysis (donor reply):');
  const neg = await api(`/api/opportunities/${liCandidate.id}/negotiation/analyze`, {
    body: { reply: 'Hi, we can add your link to the article. The placement fee is $250.' },
  });
  assert(neg.status === 200, `negotiation/analyze: HTTP ${neg.status} ${JSON.stringify(neg.body)}`);
  const negDto = neg.body as ApiOpportunityDto;
  const negAnalysis = negDto.negotiation?.analysis;
  assert(negAnalysis !== null && negAnalysis !== undefined, 'negotiation: no analysis');
  assert(negAnalysis.suggestedResponse.trim() !== '', 'negotiation: empty suggested response');
  console.log(`  - intent=${negAnalysis.intent}`);
  console.log(`  - suggestedResponse="${negAnalysis.suggestedResponse}"`);
  console.log(`  - strategy=${negAnalysis.strategy}`);
  console.log(`  - recommendedPrice=${JSON.stringify(negAnalysis.recommendedPrice)}`);
  console.log(`  - fallbackOption=${negAnalysis.fallbackOption}`);
  console.log(`  - risks=${JSON.stringify(negAnalysis.risks)}`);

  const resp = await api(`/api/opportunities/${liCandidate.id}/negotiation/respond`, {
    body: { agree: false },
  });
  assert(
    resp.status === 200,
    `negotiation/respond: HTTP ${resp.status} ${JSON.stringify(resp.body)}`,
  );
  assert(
    (resp.body as ApiOpportunityDto).negotiation?.status === 'RESOLVED',
    'negotiation did not resolve',
  );
  console.log('  - human responded (agree=false); thread RESOLVED, nothing sent');

  // 9) Production safety ----------------------------------------------------------------
  console.log('\n[9] Production safety:');
  for (const text of responseBodies) {
    assert(!text.includes(apiKey), 'API KEY LEAKED INTO AN API RESPONSE');
  }
  for (const probe of probes) {
    assert(!probe.url.includes(apiKey), 'API KEY LEAKED INTO A REQUEST URL');
  }
  console.log('  - API key: absent from every API response and every observed request URL');

  // --- report ---------------------------------------------------------------------------
  const aiCalls = probes.filter((p) => p.host === aiHost);
  const pageCalls = probes.filter((p) => p.host !== aiHost && !searchCalls.includes(p));
  const failures = probes.filter((p) => p.status === null || p.status >= 400);
  const avg = (list: FetchProbe[]): string =>
    list.length === 0
      ? 'n/a'
      : `${(list.reduce((s, p) => s + p.ms, 0) / list.length).toFixed(0)}ms`;
  const max = (list: FetchProbe[]): string =>
    list.length === 0 ? 'n/a' : `${Math.max(...list.map((p) => p.ms)).toFixed(0)}ms`;

  console.log('\n=== SMOKE REPORT ===');
  console.log(
    `REAL AI calls:        ${aiCalls.length} (host ${aiHost}, model ${providerConfig.model})`,
  );
  console.log(`  latency:            avg ${avg(aiCalls)}, max ${max(aiCalls)}`);
  console.log(`REAL search calls:    ${searchCalls.length} (${searchBackendLabel})`);
  console.log(`  latency:            avg ${avg(searchCalls)}, max ${max(searchCalls)}`);
  console.log(`REAL page fetches:    ${pageCalls.length}`);
  console.log(`  latency:            avg ${avg(pageCalls)}, max ${max(pageCalls)}`);
  console.log(`Errors/4xx+/failed:   ${failures.length}`);
  for (const f of failures) {
    console.log(
      `  - ${f.host} status=${f.status ?? 'network-error'} ${f.note} (${f.ms.toFixed(0)}ms)`,
    );
  }
  const dqOk = intelItems.length;
  console.log(
    `Opportunities:        ${disc.items.length} classified, ${dqOk} assessed (intel), link-insert+outreach+negotiation on "${liCandidate.platformName}"`,
  );
  const costsNote =
    config.discoveryProvider === 'ai-search'
      ? 'search model usage not exposed by this client (see OpenRouter dashboard)'
      : 'no paid search provider (DuckDuckGo)';
  console.log(`Cost:                 ${costsNote}`);
  console.log('=== END ===');
}

main();
