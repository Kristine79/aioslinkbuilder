/**
 * Deterministic end-to-end demo: the seeded Nordhaus premium furniture
 * campaign runs the complete backend prototype pipeline — company analysis
 * through placement verification — on the MockProvider, without any real
 * external API, browser automation or web crawling.
 *
 * The scenario mirrors the Prisma seed data (categories, platforms,
 * providers, Nordhaus company/campaign) in-memory, so it runs anywhere
 * without a database. All AI output is fixed fixtures; every step is
 * deterministic.
 *
 * Run with: pnpm demo
 */

import { CompleteManualPlacementUseCase } from '@aios/application';

import {
  approveScenarioOpportunity,
  createNordhausEnvironment,
  executeScenarioPlacement,
  monitorScenarioPlacement,
  requestManualScenarioPlacement,
  seedNordhausScenario,
  verifyScenarioPlacement,
  NORDHAUS_PLATFORM_IDS,
} from './nordhaus-environment.js';

export interface NordhausDemoReport {
  campaignId: string;
  strategyItems: Array<{ categoryCode: string; placementType: string }>;
  opportunities: Array<{ platformId: string; method: string; status: string }>;
  placements: Array<{ providerId: string | null; status: string }>;
  verificationCount: number;
  evidenceCount: number;
  auditActions: string[];
}

export async function runNordhausDemo(): Promise<NordhausDemoReport> {
  const env = createNordhausEnvironment();
  const steps: string[] = [];
  const record = (message: string): void => {
    steps.push(message);
    console.log(message);
  };

  const seed = await seedNordhausScenario(env);
  record(`[0] Seeded company "${seed.company.name}" and campaign "${seed.campaign.name}"`);
  const relevantCategories = seed.analysis.structuredOutput.relevantCategories;
  record(
    `[1] AnalyzeCompany: stored VALID COMPANY_ANALYSIS (${Array.isArray(relevantCategories) ? relevantCategories.length : 0} relevant categories)`,
  );
  const strategyItems = seed.strategy.items.map((item) => ({
    categoryCode: item.categoryCode,
    placementType: item.placementType,
  }));
  record(
    `[2] GeneratePlacementStrategy: ${strategyItems.map((item) => `${item.categoryCode} -> ${item.placementType}`).join(', ')}`,
  );
  record(
    `[3] DiscoverOpportunities: ${seed.discovered.length} DISCOVERED (${seed.discovered.map((o) => o.platformId).join(', ')})`,
  );
  for (const opportunity of seed.classified) {
    record(
      `[4] ClassifyOpportunity ${opportunity.platformId}: score ${opportunity.score}, method ${opportunity.placementMethod}, type ${opportunity.placementType}`,
    );
  }

  // Step 5: approve all executable + manual opportunities.
  const targets = [
    NORDHAUS_PLATFORM_IDS.yandex,
    NORDHAUS_PLATFORM_IDS.twoGis,
    NORDHAUS_PLATFORM_IDS.mebel,
    NORDHAUS_PLATFORM_IDS.archi,
    NORDHAUS_PLATFORM_IDS.inmyroom,
  ];
  const approvals: string[] = [];
  for (const platformId of targets) {
    const opportunity = seed.classified.find((candidate) => candidate.platformId === platformId);
    if (opportunity === undefined) {
      throw new Error(`demo expected opportunity for ${platformId}`);
    }
    await approveScenarioOpportunity(env, platformId);
    approvals.push(platformId);
  }
  record(`[5] ApproveOpportunity: ${approvals.length} opportunities SELECTED`);

  // Step 6: execution. Archi.ru fails once (failCreate: 1) and is retried
  // with a fresh attempt record; 2GIS stays in the submitted pipeline.
  const executionResults: Array<{ platformId: string; status: string; placementId: string }> = [];
  for (const platformId of [
    NORDHAUS_PLATFORM_IDS.yandex,
    NORDHAUS_PLATFORM_IDS.mebel,
    NORDHAUS_PLATFORM_IDS.twoGis,
    NORDHAUS_PLATFORM_IDS.archi,
  ]) {
    try {
      const placement = await executeScenarioPlacement(env, platformId);
      executionResults.push({ platformId, status: placement.status, placementId: placement.id });
      record(`[6] ExecutePlacement ${platformId}: ${placement.status} via ${placement.providerId}`);
    } catch (error) {
      record(
        `[6] ExecutePlacement ${platformId}: attempt FAILED (${error instanceof Error ? error.message : String(error)})`,
      );
      const retry = await executeScenarioPlacement(env, platformId);
      executionResults.push({ platformId, status: retry.status, placementId: retry.id });
      record(`[6] ExecutePlacement ${platformId} (retry, fresh attempt): ${retry.status}`);
    }
  }

  // Step 7: monitoring — 2GIS publishes after one poll.
  for (const result of executionResults) {
    if (result.status === 'SUBMITTED' || result.status === 'PENDING_PUBLICATION') {
      const monitored = await monitorScenarioPlacement(env, result.placementId);
      record(`[7] MonitorPlacement ${result.platformId}: -> ${monitored.status}`);
    }
  }

  // Step 8: human-in-the-loop — INMYROOM is completed manually with proof.
  const manualPlacement = await requestManualScenarioPlacement(
    env,
    NORDHAUS_PLATFORM_IDS.inmyroom,
    'Complete the partner application on inmyroom.ru',
  );
  record(`[8] RequestManualPlacement INMYROOM: placement NEEDS_MANUAL (reason recorded)`);
  const completeManual = new CompleteManualPlacementUseCase(env.placements, env.auditLog);
  await completeManual.execute({
    placementId: manualPlacement.id,
    externalId: 'inmyroom/nordhaus',
    liveUrl: 'https://inmyroom.example/nordhaus',
    notes: 'Profile approved by the editor',
  });
  record(
    '[8] CompleteManualPlacement INMYROOM: NEEDS_MANUAL -> PUBLISHED with proof (externalId + liveUrl)',
  );

  // Step 9: verification of every published placement.
  for (const placement of [...env.placements.placements.values()]) {
    if (placement.status === 'PUBLISHED') {
      const result = await verifyScenarioPlacement(env, placement.id);
      record(`[9] VerifyPlacement ${placement.providerId}: -> ${result.placement.status}`);
    }
  }

  const report: NordhausDemoReport = {
    campaignId: seed.campaign.id,
    strategyItems,
    opportunities: [...env.opportunities.opportunities.values()].map((opportunity) => ({
      platformId: opportunity.platformId,
      method: opportunity.placementMethod,
      status: opportunity.status,
    })),
    placements: [...env.placements.placements.values()].map((placement) => ({
      providerId: placement.providerId,
      status: placement.status,
    })),
    verificationCount: env.verifications.verifications.size,
    evidenceCount: env.evidence.evidence.size,
    auditActions: env.auditLog.entries.map((entry) => entry.action),
  };

  record(
    `[done] ${report.placements.filter((p) => p.status === 'VERIFIED').length} placements VERIFIED, ` +
      `${report.placements.filter((p) => p.status === 'FAILED').length} failed attempt recorded, ` +
      `${report.verificationCount} verifications, ${report.evidenceCount} evidence rows, ` +
      `${report.auditActions.length} audit events`,
  );
  return report;
}
