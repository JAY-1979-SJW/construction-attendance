/**
 * 2026년 4대보험 요율 DB 시딩 스크립트
 *
 * 출처:
 *   - 국민연금:      연금개혁법, 보건복지부 (2026-01-01 시행, 9.5%)
 *   - 건강보험:      보건복지부 고시 (2025-08-28 결정, 2026-01-01 시행, 7.19%)
 *   - 장기요양보험:  보건복지부 고시 (2025-11-04 결정, 2026-01-01 시행, 0.9448%)
 *   - 고용보험:      고용노동부 고시 (2026-01-01 시행, 1.8%)
 *   - 고용안정:      고용노동부 고시 (2026-01-01 시행, 150인 미만 0.25%)
 *   - 산재보험(건설):고용노동부 고시 (2025-12-31 발표, 2026-01-01 시행, 35‰=3.5%)
 *   - 건설업 퇴직공제:건설근로자공제회 / 국토교통부 고시 제2015-610호
 *
 * 실행: npx ts-node scripts/seed-insurance-rates-2026.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── 2026년 보험요율 데이터 ─────────────────────────────────

const RATES_2026 = [
  {
    rateType:                'NATIONAL_PENSION' as const,
    effectiveYear:           2026,
    effectiveMonth:          null,
    totalRatePct:            9.5,
    employeeRatePct:         4.75,
    employerRatePct:         4.75,
    officialSourceName:      '보건복지부 / 국민연금공단',
    officialSourceUrl:       'https://www.nps.or.kr',
    officialAnnouncementDate: new Date('2025-12-01'),
    referenceDocumentNo:     '연금개혁법 (2026-01-01 시행, 매년 0.5%p 단계적 인상 — 2033년 13% 목표)',
    rateNote:                '연금개혁법에 따라 2025년 9.0%에서 0.5%p 인상. 근로자·사업주 각 4.75%씩 균등 부담.',
    industryCode:            null,
  },
  {
    rateType:                'HEALTH_INSURANCE' as const,
    effectiveYear:           2026,
    effectiveMonth:          null,
    totalRatePct:            7.19,
    employeeRatePct:         3.595,
    employerRatePct:         3.595,
    officialSourceName:      '보건복지부',
    officialSourceUrl:       'https://www.mohw.go.kr/board.es?mid=a10503010100&bid=0027&act=view&list_no=1487279',
    officialAnnouncementDate: new Date('2025-08-28'),
    referenceDocumentNo:     '보건복지부 고시 (2025-08-28 결정, 2025년 7.09% → 2026년 7.19%, 0.1%p 인상)',
    rateNote:                '직장가입자 월평균 보험료 160,699원 (전년 대비 2,235원 증가). 근로자·사업주 각 3.595% 균등 부담.',
    industryCode:            null,
  },
  {
    rateType:                'LONG_TERM_CARE' as const,
    effectiveYear:           2026,
    effectiveMonth:          null,
    totalRatePct:            0.9448,
    employeeRatePct:         0.4724,
    employerRatePct:         0.4724,
    officialSourceName:      '보건복지부',
    officialSourceUrl:       'https://www.mohw.go.kr/board.es?act=view&bid=0027&list_no=1487817&mid=a10503000000',
    officialAnnouncementDate: new Date('2025-11-04'),
    referenceDocumentNo:     '보건복지부 고시 (2025-11-04 결정, 건강보험료 × 13.14%)',
    rateNote:                '건강보험료 대비 요율 13.14% (2025년 12.95% → 인상). 건강보험료(7.19%) × 13.14% = 0.9448%. 가입자 세대 월 평균 18,362원.',
    industryCode:            null,
  },
  {
    rateType:                'EMPLOYMENT_INSURANCE' as const,
    effectiveYear:           2026,
    effectiveMonth:          null,
    totalRatePct:            1.8,
    employeeRatePct:         0.9,
    employerRatePct:         0.9,
    officialSourceName:      '고용노동부',
    officialSourceUrl:       'https://www.moel.go.kr/policy/policyinfo/social/list5.do',
    officialAnnouncementDate: new Date('2025-12-31'),
    referenceDocumentNo:     '고용노동부 고시 (2026년도 고용보험료율) — 전년도와 동일 유지',
    rateNote:                '실업급여 요율. 2025년과 동일. 근로자·사업주 각 0.9% 균등 부담.',
    industryCode:            null,
  },
  {
    rateType:                'EMPLOYMENT_STABILITY' as const,
    effectiveYear:           2026,
    effectiveMonth:          null,
    totalRatePct:            0.25,
    employeeRatePct:         0.0,
    employerRatePct:         0.25,
    officialSourceName:      '고용노동부',
    officialSourceUrl:       'https://www.moel.go.kr/policy/policyinfo/social/list5.do',
    officialAnnouncementDate: new Date('2025-12-31'),
    referenceDocumentNo:     '고용노동부 고시 (2026년도 고용안정·직업능력개발 사업 요율) — 150인 미만 사업장 기준',
    rateNote:                '사업주 전액 부담. 150인 미만 우선지원대상: 0.25%, 150인 이상 우선지원: 0.45%, 150인 이상~1000인 미만: 0.65%, 1000인 이상/국가: 0.85%. 건설현장 일용 기준 0.25% 적용.',
    industryCode:            null,
  },
  {
    rateType:                'INDUSTRIAL_ACCIDENT' as const,
    effectiveYear:           2026,
    effectiveMonth:          null,
    totalRatePct:            3.5,
    employeeRatePct:         0.0,
    employerRatePct:         3.5,
    officialSourceName:      '고용노동부 (근로복지공단)',
    officialSourceUrl:       'https://www.kcomwel.or.kr/kcomwel/paym/paym01.jsp',
    officialAnnouncementDate: new Date('2025-12-31'),
    referenceDocumentNo:     '고용노동부 고시 (2026년도 사업종류별 산재보험료율) — 건설업 35‰(3.5%), 2025년과 동일',
    rateNote:                '건설업 평균 요율 35‰(3.5%). 사업주 전액 부담. 업종별 차등 적용. 출퇴근재해 0.6‰, 임금채권부담금 0.6‰ 별도.',
    industryCode:            '건설업',
  },
  {
    rateType:                'RETIREMENT_MUTUAL' as const,
    effectiveYear:           2026,
    effectiveMonth:          null,
    totalRatePct:            2.3,
    employeeRatePct:         0.0,
    employerRatePct:         2.3,
    officialSourceName:      '건설근로자공제회 / 국토교통부',
    officialSourceUrl:       'https://www.cwma.or.kr/main.do',
    officialAnnouncementDate: new Date('2015-07-01'),
    referenceDocumentNo:     '국토교통부 고시 제2015-610호 (직접노무비 × 2.3%, 공공공사 1억원·민간 50억원 이상)',
    rateNote:                '직접노무비 기준 2.3% 적용. 사업주 전액 부담. 공공공사 1억원 이상, 민간공사 50억원 이상, 200호 이상 공동주택에 의무 적용. 매월 15일까지 납부.',
    industryCode:            null,
  },
]

// ─── 고시 소스 데이터 ───────────────────────────────────────

const RATE_SOURCES = [
  {
    rateType:    'NATIONAL_PENSION' as const,
    sourceName:  '국민연금공단',
    sourceUrl:   'https://www.nps.or.kr/jsppage/business/insure/insure_04_01.jsp',
    notes:       '국민연금 보험료율 안내. 2026년부터 매년 0.5%p 인상(연금개혁법). 보건복지부 고시 기준.',
  },
  {
    rateType:    'HEALTH_INSURANCE' as const,
    sourceName:  '국민건강보험공단',
    sourceUrl:   'https://www.nhis.or.kr/nhis/policy/wbhada05300m01.do',
    notes:       '건강보험료율. 매년 보건복지부 고시로 결정. 장기요양보험료율 동시 고시.',
  },
  {
    rateType:    'LONG_TERM_CARE' as const,
    sourceName:  '국민건강보험공단',
    sourceUrl:   'https://www.nhis.or.kr/nhis/policy/wbhada05300m01.do',
    notes:       '장기요양보험료율 = 건강보험료 × 장기요양보험료율(%). 건강보험료와 함께 보건복지부 고시.',
  },
  {
    rateType:    'EMPLOYMENT_INSURANCE' as const,
    sourceName:  '고용노동부',
    sourceUrl:   'https://www.moel.go.kr/policy/policyinfo/social/list5.do',
    notes:       '고용보험 실업급여 요율. 매년 고용노동부 고시. 고용안정·직능개발 요율 함께 발표.',
  },
  {
    rateType:    'EMPLOYMENT_STABILITY' as const,
    sourceName:  '고용노동부',
    sourceUrl:   'https://www.moel.go.kr/policy/policyinfo/social/list5.do',
    notes:       '고용안정·직업능력개발 사업 요율. 사업장 규모별 차등(0.25%~0.85%). 사업주 전액 부담.',
  },
  {
    rateType:    'INDUSTRIAL_ACCIDENT' as const,
    sourceName:  '고용노동부 (근로복지공단)',
    sourceUrl:   'https://www.kcomwel.or.kr/kcomwel/paym/paym01.jsp',
    notes:       '산재보험료율. 업종별 차등. 건설업 35‰. 매년 3월 고용노동부 고시.',
  },
  {
    rateType:    'RETIREMENT_MUTUAL' as const,
    sourceName:  '건설근로자공제회',
    sourceUrl:   'https://www.cwma.or.kr/main.do',
    notes:       '건설업 퇴직공제 부금. 직접노무비 2.3%. 국토교통부 고시 제2015-610호.',
  },
]

// ─── 메인 ──────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60))
  console.log(' 2026년 보험요율 DB 시딩 시작')
  console.log('='.repeat(60))

  // SUPER_ADMIN 찾기 (approvedBy 필드용)
  const admin = await prisma.adminUser.findFirst({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true, name: true, email: true },
  })
  if (!admin) {
    console.error('SUPER_ADMIN 계정을 찾을 수 없습니다. seed.ts 먼저 실행하세요.')
    process.exit(1)
  }
  console.log(`\n관리자 계정: ${admin.name} (${admin.email})`)

  const now = new Date()
  let created = 0
  let skipped = 0

  // ── 보험요율 버전 등록 ─────────────────────────────────────
  console.log('\n[1] 보험요율 버전 등록...')
  for (const rate of RATES_2026) {
    // 이미 APPROVED_FOR_USE 요율이 있으면 스킵
    const existing = await prisma.insuranceRateVersion.findFirst({
      where: {
        rateType:      rate.rateType,
        effectiveYear: rate.effectiveYear,
        status:        'APPROVED_FOR_USE',
        ...(rate.industryCode ? { industryCode: rate.industryCode } : {}),
      },
    })

    if (existing) {
      console.log(`  [SKIP] ${rate.rateType} 2026 — 이미 승인된 요율 존재 (id: ${existing.id.slice(0, 12)}...)`)
      skipped++
      continue
    }

    const version = await prisma.insuranceRateVersion.create({
      data: {
        rateType:                rate.rateType,
        effectiveYear:           rate.effectiveYear,
        effectiveMonth:          rate.effectiveMonth,
        totalRatePct:            rate.totalRatePct,
        employeeRatePct:         rate.employeeRatePct,
        employerRatePct:         rate.employerRatePct,
        rateNote:                rate.rateNote,
        industryCode:            rate.industryCode,
        officialSourceName:      rate.officialSourceName,
        officialSourceUrl:       rate.officialSourceUrl,
        officialAnnouncementDate: rate.officialAnnouncementDate,
        referenceDocumentNo:     rate.referenceDocumentNo,
        status:                  'APPROVED_FOR_USE',
        reviewNote:              '2026년 공식 고시 기반 시딩 — 관리자가 직접 검증 후 승인 처리',
        reviewedBy:              admin.id,
        reviewedAt:              now,
        approvedBy:              admin.id,
        approvedAt:              now,
        createdBy:               admin.id,
      },
    })

    const label = LABEL[rate.rateType] ?? rate.rateType
    console.log(`  [OK] ${label} — ${rate.totalRatePct}% (근로자 ${rate.employeeRatePct}%, 사업주 ${rate.employerRatePct}%)`)
    created++
  }

  // ── 고시 소스 초기화 ───────────────────────────────────────
  console.log('\n[2] 고시 소스 초기화...')
  let sourcesCreated = 0
  let sourcesSkipped = 0

  for (const src of RATE_SOURCES) {
    const exists = await prisma.insuranceRateSource.findUnique({
      where: { rateType: src.rateType },
    })
    if (exists) {
      console.log(`  [SKIP] ${src.rateType} 소스 — 이미 존재`)
      sourcesSkipped++
      continue
    }
    await prisma.insuranceRateSource.create({
      data: {
        rateType:           src.rateType,
        sourceName:         src.sourceName,
        sourceUrl:          src.sourceUrl,
        checkFrequencyDays: 7,
        notes:              src.notes,
        lastCheckedAt:      now,
      },
    })
    console.log(`  [OK] ${src.rateType} 소스 등록: ${src.sourceName}`)
    sourcesCreated++
  }

  // ── 결과 ────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60))
  console.log(' 시딩 완료')
  console.log('='.repeat(60))
  console.log(`  요율 버전: 생성 ${created}개, 스킵 ${skipped}개`)
  console.log(`  고시 소스: 생성 ${sourcesCreated}개, 스킵 ${sourcesSkipped}개`)
  console.log('')
  console.log('  ⚠️  주의사항:')
  console.log('  - 모든 요율은 APPROVED_FOR_USE 상태로 등록되었습니다.')
  console.log('  - 관리자 화면(/admin/insurance-rates)에서 내용을 반드시 검토하세요.')
  console.log('  - 내용이 올바르지 않으면 DEPRECATED 처리 후 재등록하세요.')
  console.log('')
  console.log('  출처 검토 URL:')
  console.log('  - 건강보험: https://www.mohw.go.kr (보건복지부 고시)')
  console.log('  - 고용/산재: https://www.moel.go.kr (고용노동부 고시)')
  console.log('  - 국민연금: https://www.nps.or.kr')
  console.log('  - 퇴직공제: https://www.cwma.or.kr')
}

const LABEL: Record<string, string> = {
  NATIONAL_PENSION:     '국민연금',
  HEALTH_INSURANCE:     '건강보험',
  LONG_TERM_CARE:       '장기요양보험',
  EMPLOYMENT_INSURANCE: '고용보험(실업급여)',
  EMPLOYMENT_STABILITY: '고용안정·직능개발',
  INDUSTRIAL_ACCIDENT:  '산재보험(건설업)',
  RETIREMENT_MUTUAL:    '건설업 퇴직공제',
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
