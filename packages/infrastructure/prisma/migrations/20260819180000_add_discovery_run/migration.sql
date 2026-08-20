-- Persist the discovery run state per campaign (backend source of truth).

-- CreateEnum
CREATE TYPE "DiscoveryRunStatus" AS ENUM ('NOT_RUN', 'RUNNING', 'COMPLETED_WITH_RESULTS', 'COMPLETED_EMPTY', 'FAILED');

-- CreateTable
CREATE TABLE "DiscoveryRun" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" "DiscoveryRunStatus" NOT NULL DEFAULT 'NOT_RUN',
    "lastRunAt" TIMESTAMP(3),
    "discoveredCount" INTEGER NOT NULL DEFAULT 0,
    "classifiedCount" INTEGER NOT NULL DEFAULT 0,
    "sources" TEXT[],
    "failure" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryRun_campaignId_key" ON "DiscoveryRun"("campaignId");

-- CreateIndex
CREATE INDEX "DiscoveryRun_campaignId_idx" ON "DiscoveryRun"("campaignId");

-- AddForeignKey
ALTER TABLE "DiscoveryRun" ADD CONSTRAINT "DiscoveryRun_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
