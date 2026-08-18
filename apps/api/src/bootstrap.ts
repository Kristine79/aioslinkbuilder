/**
 * Bootstraps the API server state: the Nordhaus scenario runs the real
 * application pipeline up to a mid-flight checkpoint so the UI opens with
 * live content (verified, in-progress, failed, manual and awaiting-approval
 * items). Every step runs through the actual use cases; the user continues
 * the flow from the UI.
 */

import type { Company, Campaign } from '@aios/domain';

import type { ApiServices } from './app.js';
import {
  NORDHAUS_PLATFORM_IDS,
  approveScenarioOpportunity,
  createNordhausEnvironment,
  executeScenarioPlacement,
  requestManualScenarioPlacement,
  seedNordhausScenario,
  verifyScenarioPlacement,
  type NordhausEnvironment,
} from './scenario/nordhaus-environment.js';

export interface NordhausBootstrap extends ApiServices {
  env: NordhausEnvironment;
  company: Company;
  campaign: Campaign;
}

export async function runNordhausBootstrap(): Promise<NordhausBootstrap> {
  const env = createNordhausEnvironment();
  const seed = await seedNordhausScenario(env);

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
