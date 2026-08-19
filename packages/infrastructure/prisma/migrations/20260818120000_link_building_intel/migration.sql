-- Link-building intelligence extension: new placement types and AI analysis
-- kinds for donor quality, page analysis, anchor strategy, link insert,
-- outreach and negotiation.

ALTER TYPE "PlacementType" ADD VALUE 'LINK_INSERT';
ALTER TYPE "PlacementType" ADD VALUE 'GUEST_POST';
ALTER TYPE "PlacementType" ADD VALUE 'RESOURCE_PAGE';
ALTER TYPE "PlacementType" ADD VALUE 'PARTNER_PAGE';

ALTER TYPE "AIAnalysisType" ADD VALUE 'PAGE_ANALYSIS';
ALTER TYPE "AIAnalysisType" ADD VALUE 'LINK_INSERT_PREPARATION';
ALTER TYPE "AIAnalysisType" ADD VALUE 'ANCHOR_RECOMMENDATION';
ALTER TYPE "AIAnalysisType" ADD VALUE 'OUTREACH_MESSAGE';
ALTER TYPE "AIAnalysisType" ADD VALUE 'NEGOTIATION_ANALYSIS';
ALTER TYPE "AIAnalysisType" ADD VALUE 'DONOR_QUALITY_ESTIMATES';
ALTER TYPE "AIAnalysisType" ADD VALUE 'DONOR_RISK';
