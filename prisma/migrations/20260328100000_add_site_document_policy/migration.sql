-- CreateTable: 현장별 문서정책
CREATE TABLE "site_document_policies" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "docType" "OnboardingDocType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_document_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_document_policies_siteId_idx" ON "site_document_policies"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "site_document_policies_siteId_docType_key" ON "site_document_policies"("siteId", "docType");

-- AddForeignKey
ALTER TABLE "site_document_policies" ADD CONSTRAINT "site_document_policies_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
