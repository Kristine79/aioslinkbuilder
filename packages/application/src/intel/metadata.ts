import type {
  AnchorRecommendation,
  DonorQualityProfile,
  DonorRiskAssessment,
  LinkInsertDraft,
  NegotiationSession,
  OutreachDraft,
  PageAnalysis,
  ScoreV2Components,
} from '@aios/domain';

/**
 * Typed read/write helpers for the opportunity intelligence metadata.
 *
 * The intel (donor quality, page analysis, risk, score v2, link insert,
 * anchor strategy, outreach, negotiation) is stored as structured JSON under
 * the opportunity metadata — the same JSON columns the schema already uses
 * for discovery metadata and manual placement notes. These helpers keep the
 * metadata access type-safe in the application and delivery layers.
 */

export interface OpportunityIntel {
  donorQuality: DonorQualityProfile | null;
  pageAnalysis: PageAnalysis | null;
  risk: DonorRiskAssessment | null;
  scoreV2: ScoreV2Components | null;
  linkInsert: LinkInsertDraft | null;
  anchorStrategy: AnchorRecommendation | null;
  outreach: OutreachDraft | null;
  negotiation: NegotiationSession | null;
}

export function readIntel(metadata: Readonly<Record<string, unknown>> | null): OpportunityIntel {
  if (metadata === null) {
    return emptyIntel();
  }
  return {
    donorQuality: recordOrNull<DonorQualityProfile>(metadata.donorQuality),
    pageAnalysis: recordOrNull<PageAnalysis>(metadata.pageAnalysis),
    risk: recordOrNull<DonorRiskAssessment>(metadata.riskAssessment),
    scoreV2: recordOrNull<ScoreV2Components>(metadata.scoreV2),
    linkInsert: recordOrNull<LinkInsertDraft>(metadata.linkInsert),
    anchorStrategy: recordOrNull<AnchorRecommendation>(metadata.anchorStrategy),
    outreach: recordOrNull<OutreachDraft>(metadata.outreach),
    negotiation: recordOrNull<NegotiationSession>(metadata.negotiation),
  };
}

export function emptyIntel(): OpportunityIntel {
  return {
    donorQuality: null,
    pageAnalysis: null,
    risk: null,
    scoreV2: null,
    linkInsert: null,
    anchorStrategy: null,
    outreach: null,
    negotiation: null,
  };
}

export function writeIntel(
  metadata: Readonly<Record<string, unknown>> | null,
  patch: Partial<OpportunityIntel>,
): Readonly<Record<string, unknown>> {
  const current = metadata ?? {};
  const next: Record<string, unknown> = { ...current };
  if (patch.donorQuality !== undefined) {
    if (patch.donorQuality === null) delete next.donorQuality;
    else next.donorQuality = patch.donorQuality;
  }
  if (patch.pageAnalysis !== undefined) {
    if (patch.pageAnalysis === null) delete next.pageAnalysis;
    else next.pageAnalysis = patch.pageAnalysis;
  }
  if (patch.risk !== undefined) {
    if (patch.risk === null) delete next.riskAssessment;
    else next.riskAssessment = patch.risk;
  }
  if (patch.scoreV2 !== undefined) {
    if (patch.scoreV2 === null) delete next.scoreV2;
    else next.scoreV2 = patch.scoreV2;
  }
  if (patch.linkInsert !== undefined) {
    if (patch.linkInsert === null) delete next.linkInsert;
    else next.linkInsert = patch.linkInsert;
  }
  if (patch.anchorStrategy !== undefined) {
    if (patch.anchorStrategy === null) delete next.anchorStrategy;
    else next.anchorStrategy = patch.anchorStrategy;
  }
  if (patch.outreach !== undefined) {
    if (patch.outreach === null) delete next.outreach;
    else next.outreach = patch.outreach;
  }
  if (patch.negotiation !== undefined) {
    if (patch.negotiation === null) delete next.negotiation;
    else next.negotiation = patch.negotiation;
  }
  return next;
}

function recordOrNull<T>(value: unknown): T | null {
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as T;
}
