-- CreateEnum
CREATE TYPE "PlacementStatus" AS ENUM ('DISCOVERED', 'QUALIFIED', 'SELECTED', 'READY', 'SUBMITTED', 'PENDING_PUBLICATION', 'PUBLISHED', 'VERIFIED', 'FAILED', 'BLOCKED', 'NEEDS_MANUAL', 'VERIFICATION_FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PlacementType" AS ENUM ('BACKLINK', 'BRAND_MENTION', 'BUSINESS_PROFILE', 'DIRECTORY_LISTING', 'PRODUCT_LISTING', 'EDITORIAL_PUBLICATION', 'SOCIAL_PROFILE', 'REFERRAL_TRAFFIC');

-- CreateEnum
CREATE TYPE "PlacementMethod" AS ENUM ('API', 'SEMI_AUTOMATED', 'BROWSER', 'MANUAL', 'OUTREACH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('API', 'BROWSER', 'MANUAL', 'MOCK');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('LIVE_URL', 'SCREENSHOT', 'PAGE_CONTENT', 'COMPANY_MATCH', 'WEBSITE_MATCH', 'BACKLINK_MATCH');

-- CreateEnum
CREATE TYPE "AIAnalysisType" AS ENUM ('COMPANY_ANALYSIS', 'OPPORTUNITY_CLASSIFICATION', 'CONTENT_PREPARATION');

-- CreateEnum
CREATE TYPE "AIAnalysisValidationStatus" AS ENUM ('VALID', 'INVALID');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "industry" TEXT,
    "geography" TEXT[],
    "locations" TEXT[],
    "products" TEXT[],
    "targetAudience" TEXT[],
    "website" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goals" TEXT[],
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlacementCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Platform" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "country" TEXT,
    "categoryId" TEXT,
    "notes" TEXT,
    "metadata" JSONB,

    CONSTRAINT "Platform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementProvider" (
    "id" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerType" "ProviderType" NOT NULL,
    "capabilities" JSONB NOT NULL DEFAULT '[]',
    "capabilitiesVerified" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "PlacementProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementOpportunity" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "categoryId" TEXT,
    "placementType" "PlacementType" NOT NULL,
    "relevance" TEXT,
    "score" INTEGER,
    "scoreBreakdown" JSONB,
    "recommendation" TEXT,
    "whyRecommended" TEXT,
    "placementMethod" "PlacementMethod" NOT NULL DEFAULT 'UNKNOWN',
    "providerCapabilities" JSONB NOT NULL DEFAULT '[]',
    "status" "PlacementStatus" NOT NULL DEFAULT 'DISCOVERED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacementOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Placement" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "providerId" TEXT,
    "status" "PlacementStatus" NOT NULL DEFAULT 'READY',
    "externalId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "liveUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Placement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "checkedAt" TIMESTAMP(3),
    "result" JSONB,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "url" TEXT,
    "content" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAnalysis" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "analysisType" "AIAnalysisType" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "inputReference" JSONB,
    "structuredOutput" JSONB NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "validationStatus" "AIAnalysisValidationStatus" NOT NULL DEFAULT 'VALID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campaign_companyId_idx" ON "Campaign"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementCategory_code_key" ON "PlacementCategory"("code");

-- CreateIndex
CREATE INDEX "PlacementCategory_sortOrder_idx" ON "PlacementCategory"("sortOrder");

-- CreateIndex
CREATE INDEX "Platform_categoryId_idx" ON "Platform"("categoryId");

-- CreateIndex
CREATE INDEX "PlacementProvider_platformId_idx" ON "PlacementProvider"("platformId");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementProvider_platformId_providerType_key" ON "PlacementProvider"("platformId", "providerType");

-- CreateIndex
CREATE INDEX "PlacementOpportunity_campaignId_idx" ON "PlacementOpportunity"("campaignId");

-- CreateIndex
CREATE INDEX "PlacementOpportunity_platformId_idx" ON "PlacementOpportunity"("platformId");

-- CreateIndex
CREATE INDEX "PlacementOpportunity_status_idx" ON "PlacementOpportunity"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementOpportunity_campaignId_platformId_key" ON "PlacementOpportunity"("campaignId", "platformId");

-- CreateIndex
CREATE INDEX "Placement_opportunityId_idx" ON "Placement"("opportunityId");

-- CreateIndex
CREATE INDEX "Placement_providerId_idx" ON "Placement"("providerId");

-- CreateIndex
CREATE INDEX "Placement_status_idx" ON "Placement"("status");

-- CreateIndex
CREATE INDEX "Verification_placementId_idx" ON "Verification"("placementId");

-- CreateIndex
CREATE INDEX "Evidence_verificationId_idx" ON "Evidence"("verificationId");

-- CreateIndex
CREATE INDEX "AIAnalysis_campaignId_idx" ON "AIAnalysis"("campaignId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Platform" ADD CONSTRAINT "Platform_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PlacementCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementProvider" ADD CONSTRAINT "PlacementProvider_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementOpportunity" ADD CONSTRAINT "PlacementOpportunity_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementOpportunity" ADD CONSTRAINT "PlacementOpportunity_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementOpportunity" ADD CONSTRAINT "PlacementOpportunity_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PlacementCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "PlacementOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "PlacementProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "Verification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAnalysis" ADD CONSTRAINT "AIAnalysis_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
