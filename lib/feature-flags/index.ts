import { prisma } from '@/lib/db/prisma'
import { NextResponse } from 'next/server'
import { forbidden } from '@/lib/utils/response'

/** 지원되는 기능 플래그 목록 */
export type FeatureFlagKey =
  | 'attendanceEnabled'
  | 'workerManagementEnabled'
  | 'laborCostEditEnabled'
  | 'deviceApprovalEnabled'
  | 'payrollViewEnabled'
  | 'documentUploadEnabled'
  | 'siteManagerEnabled'
  | 'workReportEnabled'
  | 'photoReportEnabled'
  | 'insuranceDocsEnabled'
  | 'laborDocsEnabled'
  | 'payrollExportEnabled'

/** 기본값 — 무료 플랜 기준 */
export const DEFAULT_FEATURE_FLAGS: Record<FeatureFlagKey, boolean> = {
  attendanceEnabled:       true,
  workerManagementEnabled: true,
  laborCostEditEnabled:    false,
  deviceApprovalEnabled:   false,
  payrollViewEnabled:      false,
  documentUploadEnabled:   false,
  siteManagerEnabled:      false,
  workReportEnabled:       false,
  photoReportEnabled:      false,
  insuranceDocsEnabled:    false,
  laborDocsEnabled:        false,
  payrollExportEnabled:    false,
}

/** 기능 플래그 레이블 (UI용) */
export const FEATURE_FLAG_LABELS: Record<FeatureFlagKey, string> = {
  attendanceEnabled:       '출퇴근 관리',
  workerManagementEnabled: '근로자 관리',
  laborCostEditEnabled:    '공수 수정 (유료)',
  deviceApprovalEnabled:   '기기 승인 관리 (유료)',
  payrollViewEnabled:      '급여 조회 (유료)',
  documentUploadEnabled:   '문서 업로드 (유료)',
  siteManagerEnabled:      '현장 관리자 기능 (유료)',
  workReportEnabled:       '업무 보고 (유료)',
  photoReportEnabled:      '사진 보고 (유료)',
  insuranceDocsEnabled:    '4대보험 서류 (유료)',
  laborDocsEnabled:        '노임서류/대장 (유료)',
  payrollExportEnabled:    '정산 엑셀 출력 (유료)',
}

/** 업체의 기능 플래그를 조회 (기본값과 병합) */
export async function getFeatureFlags(companyId: string): Promise<Record<FeatureFlagKey, boolean>> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { featureFlagsJson: true },
  })
  if (!company) return { ...DEFAULT_FEATURE_FLAGS }
  const stored = (company.featureFlagsJson ?? {}) as Partial<Record<FeatureFlagKey, boolean>>
  return { ...DEFAULT_FEATURE_FLAGS, ...stored }
}

/** 특정 기능이 활성화되어 있는지 확인 */
export async function isFeatureEnabled(companyId: string, flag: FeatureFlagKey): Promise<boolean> {
  const flags = await getFeatureFlags(companyId)
  return flags[flag] ?? DEFAULT_FEATURE_FLAGS[flag]
}

/**
 * 기능 플래그 가드 — 비활성화 시 403 반환.
 * 반환값이 null이 아니면 즉시 return 처리해야 합니다.
 */
export async function requireFeature(
  companyId: string,
  flag: FeatureFlagKey
): Promise<NextResponse<unknown> | null> {
  const enabled = await isFeatureEnabled(companyId, flag)
  if (!enabled) {
    return forbidden(`'${FEATURE_FLAG_LABELS[flag]}' 기능이 비활성화되어 있습니다. 관리자에게 문의하세요.`)
  }
  return null
}
