import type { CapabilitySet, ProviderCapability } from '@aios/domain';
import { UnsupportedCapabilityError, supportsCapability } from '@aios/domain';

import type {
  CreateInput,
  CreateResult,
  DiscoverInput,
  DiscoverResult,
  StatusInput,
  StatusResult,
  UpdateInput,
  UpdateResult,
  ValidateInput,
  ValidateResult,
  VerifyInput,
  VerifyResult,
} from '../contracts/types.js';
import type { PlacementProvider } from '../contracts/placement-provider.js';
import { ProviderError } from '../errors.js';

/**
 * Statuses the mock can report. They mirror the status taxonomy proven in
 * SEOFlow (STATUS_MODEL.md) and are interpreted deterministically by
 * MonitorPlacementUseCase.
 */
export type MockPlacementStatus =
  | 'pending_moderation'
  | 'pending_publication'
  | 'processing'
  | 'published'
  | 'failed'
  | 'rejected'
  | 'needs_manual'
  | 'blocked';

export interface MockPlacementProviderOptions {
  /**
   * When true, create() reports an immediate publication (status "published"
   * with a synthetic live URL). This is the fast demo mode. When false,
   * create() reports "pending_publication" so a later getStatus() poll can
   * transition the placement to PUBLISHED. Default: true.
   */
  alwaysPublish?: boolean;
  /**
   * Deterministic poll-driven status lifecycle: create() reports the first
   * status; every subsequent getStatus() poll advances one step; the last
   * status is terminal. Overrides alwaysPublish when provided. Example:
   * ['pending_moderation', 'pending_publication', 'published'].
   */
  timeline?: readonly MockPlacementStatus[];
  /**
   * Simulates create() failures by rejecting with ProviderError. true fails
   * every create(); a number fails that many initial create() calls, which
   * lets the demo prove the FAILED -> retry path.
   */
  failCreate?: boolean | number;
  /** Simulates a verification failure by returning verified: false. */
  failVerify?: boolean;
}

const DEFAULT_PENDING_TIMELINE: readonly MockPlacementStatus[] = [
  'pending_publication',
  'published',
];

/**
 * Deterministic stateful mock placement provider used for the prototype demo
 * and tests (INTEGRATIONS.md: Mock Provider — used for prototype development
 * and tests).
 *
 * The mock simulates an API-style submission flow: create() returns a
 * synthetic external id and (by default) immediate publication with a clearly
 * synthetic live URL (https://mock.example/...). It never claims a real
 * external API exists — the provider record keeps providerType MOCK and
 * capabilitiesVerified explicit.
 *
 * Lifecycle: each externalId has its own poll state. create() reports the
 * first status of the timeline; every getStatus() call advances the
 * placement one step towards the terminal status. The last timeline status
 * is sticky, so pending/failed/rejected/needs_manual/blocked scenarios are
 * fully deterministic and reproducible.
 */
export class MockPlacementProvider implements PlacementProvider {
  readonly providerType = 'MOCK' as const;

  private sequence = 0;
  private failedCreates = 0;
  private readonly steps = new Map<string, number>();

  constructor(
    readonly name: string,
    readonly capabilities: CapabilitySet,
    private readonly options: MockPlacementProviderOptions = {},
  ) {}

  private get timeline(): readonly MockPlacementStatus[] {
    if (this.options.timeline !== undefined) {
      return this.options.timeline;
    }
    return this.options.alwaysPublish === false
      ? DEFAULT_PENDING_TIMELINE
      : (['published'] as const);
  }

  discover(_input: DiscoverInput): Promise<DiscoverResult> {
    // Mock discovery adds no catalog data; the seeded catalog is the
    // discovery source for the prototype.
    return Promise.resolve({ opportunities: [] });
  }

  validate(_input: ValidateInput): Promise<ValidateResult> {
    const error = this.unsupported('VALIDATE', 'validate');
    if (error !== null) {
      return Promise.reject(error);
    }
    return Promise.resolve({
      valid: true,
      reason: 'Mock validation passed',
      observedCapabilities: [...this.capabilities],
    });
  }

  create(_input: CreateInput): Promise<CreateResult> {
    const error = this.unsupported('CREATE', 'create');
    if (error !== null) {
      return Promise.reject(error);
    }
    const failCreate = this.options.failCreate;
    const failEveryTime = failCreate === true;
    const failThisAttempt =
      failEveryTime || (typeof failCreate === 'number' && this.failedCreates < failCreate);
    if (failThisAttempt) {
      this.failedCreates += 1;
      return Promise.reject(
        new ProviderError(this.name, 'create', 'PLATFORM', 'Simulated create failure'),
      );
    }
    this.sequence += 1;
    const externalId = `mock-${this.sequence}-${Date.now().toString(36)}`;
    const initial = this.timeline[0] ?? 'published';
    this.steps.set(externalId, 0);
    return Promise.resolve({
      externalId,
      status: initial,
      liveUrl: initial === 'published' ? `https://mock.example/placements/${externalId}` : null,
    });
  }

  update(_input: UpdateInput): Promise<UpdateResult> {
    const error = this.unsupported('UPDATE', 'update');
    if (error !== null) {
      return Promise.reject(error);
    }
    return Promise.resolve({ status: 'updated' });
  }

  getStatus(input: StatusInput): Promise<StatusResult> {
    const error = this.unsupported('GET_STATUS', 'getStatus');
    if (error !== null) {
      return Promise.reject(error);
    }
    const step = (this.steps.get(input.externalId) ?? 0) + 1;
    this.steps.set(input.externalId, step);
    const status = this.timeline[Math.min(step, this.timeline.length - 1)] ?? 'published';
    if (status === 'published') {
      return Promise.resolve({
        status,
        liveUrl: `https://mock.example/placements/${input.externalId}`,
        publishedAt: new Date().toISOString(),
      });
    }
    return Promise.resolve({ status, liveUrl: null, publishedAt: null });
  }

  verify(input: VerifyInput): Promise<VerifyResult> {
    const error = this.unsupported('VERIFY', 'verify');
    if (error !== null) {
      return Promise.reject(error);
    }
    if (this.options.failVerify === true) {
      return Promise.resolve({
        verified: false,
        matchedCompanyName: false,
        matchedWebsite: false,
        foundBacklink: false,
        liveUrl: null,
        failureReason: 'Simulated verification failure',
      });
    }
    const matchedCompanyName = input.expected.companyName.trim().length > 0;
    const matchedWebsite =
      input.expected.website !== null && input.expected.website.trim().length > 0;
    // The mock simulates a platform that confirms the expected backlink when
    // one was expected; business profiles without an expected backlink do
    // not require one.
    const backlinkExpected = input.expected.expectedBacklink !== null;
    const foundBacklink = backlinkExpected;
    const verified = matchedCompanyName && matchedWebsite && (!backlinkExpected || foundBacklink);
    return Promise.resolve({
      verified,
      matchedCompanyName,
      matchedWebsite,
      foundBacklink,
      liveUrl: `https://mock.example/placements/${input.externalId}`,
      failureReason: verified ? null : 'Mock verification did not confirm the expected result',
    });
  }

  private unsupported(
    capability: ProviderCapability,
    operation: string,
  ): UnsupportedCapabilityError | null {
    if (supportsCapability(this.capabilities, capability)) {
      return null;
    }
    return new UnsupportedCapabilityError(capability, `${operation} via ${this.name}`);
  }
}
