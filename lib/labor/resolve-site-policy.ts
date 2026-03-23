/**
 * 현장 출퇴근·휴게 정책 resolver
 *
 * 현장별 SiteAttendancePolicy 조회 후 null 필드는 회사 기본값으로 채운다.
 * 공수 계산·문서 스냅샷 등 모든 소비자는 이 함수를 통해 정책을 조회해야 한다.
 *
 * 직접 SiteAttendancePolicy 테이블을 조회하지 말 것.
 */
import { prisma } from '@/lib/db/prisma'
import {
  COMPANY_DEFAULT_BREAK_MINUTES,
  COMPANY_DEFAULT_WORK_START,
  COMPANY_DEFAULT_WORK_END,
} from '@/lib/policies/attendance-policy'

export interface EffectiveSiteAttendancePolicy {
  /** 현장 ID */
  siteId: string
  /** 출근 기준 시각 (HH:mm, 표시·참고용) */
  workStartTime: string
  /** 퇴근 기준 시각 (HH:mm, 표시·참고용) */
  workEndTime: string
  /** 휴게 시작 시각 (HH:mm, 표시용) — null = 미설정 */
  breakStartTime: string | null
  /** 휴게 종료 시각 (HH:mm, 표시용) — null = 미설정 */
  breakEndTime: string | null
  /** 공수 계산 시 차감할 휴게시간 (분) */
  breakMinutes: number
  /** 현장 직접 설정 여부 (false = 회사 기본값 사용) */
  isCustom: boolean
}

/**
 * 현장별 실효 출퇴근 정책 조회
 *
 * SiteAttendancePolicy 레코드가 없거나 개별 필드가 null 이면 회사 기본값 사용.
 * 이 함수는 읽기 전용이며 부수효과 없음.
 */
export async function resolveEffectiveSiteAttendancePolicy(
  siteId: string,
): Promise<EffectiveSiteAttendancePolicy> {
  const policy = await prisma.siteAttendancePolicy.findUnique({
    where: { siteId },
  })

  return {
    siteId,
    workStartTime:  policy?.workStartTime  ?? COMPANY_DEFAULT_WORK_START,
    workEndTime:    policy?.workEndTime    ?? COMPANY_DEFAULT_WORK_END,
    breakStartTime: policy?.breakStartTime ?? null,
    breakEndTime:   policy?.breakEndTime   ?? null,
    breakMinutes:   policy?.breakMinutes   ?? COMPANY_DEFAULT_BREAK_MINUTES,
    isCustom:       policy != null,
  }
}
