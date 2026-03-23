-- CreateTable: 현장별 근무시간·휴게시간 정책
-- null 필드 = 회사 기본값(breakMinutes=60) 사용
-- 공수 계산 직접 적용 필드: breakMinutes
-- workStartTime/workEndTime/breakStartTime/breakEndTime 은 표시용

CREATE TABLE "site_attendance_policies" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "workStartTime" TEXT,
    "workEndTime" TEXT,
    "breakStartTime" TEXT,
    "breakEndTime" TEXT,
    "breakMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_attendance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_attendance_policies_siteId_key" ON "site_attendance_policies"("siteId");

-- AddForeignKey
ALTER TABLE "site_attendance_policies" ADD CONSTRAINT "site_attendance_policies_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
