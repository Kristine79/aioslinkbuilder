import type { Campaign, Company, PlacementOpportunity } from '@aios/domain';
import { NotFoundError } from '../errors.js';
import type { CampaignRepository } from '../ports/repositories/campaign.repository.js';
import type { CompanyRepository } from '../ports/repositories/company.repository.js';
import type { LookupRepository } from '../ports/repositories/lookup.repository.js';
import type { PlacementOpportunityRepository } from '../ports/repositories/opportunity.repository.js';
import { readIntel } from './metadata.js';
import type { OpportunityIntel } from './metadata.js';

export interface OpportunityContext {
  opportunity: PlacementOpportunity;
  campaign: Campaign;
  company: Company;
  platform: { name: string; url: string | null; category: string | null };
  intel: OpportunityIntel;
}

/**
 * Loads the common context every intelligence use case needs: the
 * opportunity, its campaign and company, the platform metadata and the
 * already-stored intel (donor quality, page analysis, link insert…).
 */
export async function loadOpportunityContext(
  deps: {
    opportunities: PlacementOpportunityRepository;
    campaigns: CampaignRepository;
    companies: CompanyRepository;
    lookups: LookupRepository;
  },
  opportunityId: string,
): Promise<OpportunityContext> {
  const opportunity = await deps.opportunities.findById(opportunityId);
  if (opportunity === null) {
    throw new NotFoundError('PlacementOpportunity', opportunityId);
  }
  const campaign = await deps.campaigns.findById(opportunity.campaignId);
  if (campaign === null) {
    throw new NotFoundError('Campaign', opportunity.campaignId);
  }
  const company = await deps.companies.findById(campaign.companyId);
  if (company === null) {
    throw new NotFoundError('Company', campaign.companyId);
  }
  const platforms = await deps.lookups.listPlatforms();
  const platform = platforms.find((candidate) => candidate.id === opportunity.platformId);
  if (platform === undefined) {
    throw new NotFoundError('Platform', opportunity.platformId);
  }
  const categories = await deps.lookups.listCategories();
  const category = categories.find((candidate) => candidate.id === platform.categoryId);
  return {
    opportunity,
    campaign,
    company,
    platform: { name: platform.name, url: platform.url, category: category?.name ?? null },
    intel: readIntel(opportunity.metadata),
  };
}
