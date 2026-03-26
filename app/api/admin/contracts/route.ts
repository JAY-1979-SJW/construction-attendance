import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession, requireRole } from '@/lib/auth/guards'
import { writeAdminAuditLog } from '@/lib/audit/write-audit-log'
import { MUTATE_ALLOWED_ROLES } from '@/lib/policies/security-policy'

// GET /api/admin/contracts
export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const workerId       = searchParams.get('workerId')       || undefined
  const siteId         = searchParams.get('siteId')         || undefined
  const contractKind   = searchParams.get('contractKind')   || undefined
  const contractStatus = searchParams.get('contractStatus') || undefined
  const templateType   = searchParams.get('templateType')   || undefined
  const expiringBefore = searchParams.get('expiringBefore') || undefined
  const page  = Math.max(1, parseInt(searchParams.get('page')  || '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '30'))

  const where: Record<string, unknown> = {
    ...(workerId       && { workerId }),
    ...(siteId         && { siteId }),
    ...(contractKind   && { contractKind }),
    ...(contractStatus && { contractStatus }),
    ...(templateType   && { contractTemplateType: templateType }),
    ...(expiringBefore && { endDate: { lte: expiringBefore }, contractStatus: 'ACTIVE' }),
  }

  const [total, contracts] = await Promise.all([
    prisma.workerContract.count({ where }),
    prisma.workerContract.findMany({
      where,
      include: {
        worker: { select: { id: true, name: true, phone: true, jobTitle: true } },
        site:   { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip:  (page - 1) * limit,
      take:  limit,
    }),
  ])

  return NextResponse.json({ success: true, data: contracts, total, page, limit })
}

// POST /api/admin/contracts
export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const deny = requireRole(session, MUTATE_ALLOWED_ROLES)
  if (deny) return deny

  const body = await req.json().catch(() => ({}))
  const {
    workerId, siteId,
    contractKind, contractTemplateType,
    startDate, endDate,
    dailyWage, monthlySalary, serviceFee,
    paymentDay, standardWorkHours, breakHours,
    nationalPensionYn, healthInsuranceYn,
    employmentInsuranceYn, industrialAccidentYn, retirementMutualYn,
    specialTerms, notes,
    // v3.1 신규 필드
    laborRelationType, businessRegistrationNo, contractorName,
    safetyClauseYn, checkInTime, checkOutTime, workDays, paymentMethod,
    reviewFlags,
    attendanceControlledByCompany, payDecidedByCompany, directPaymentByCompany,
    // v3.4 신규 필드
    projectName, workType, workTypeSub, jobCategory, jobCategorySub,
    contractForm, taskDescription,
    breakStartTime, breakEndTime,
    weeklyWorkDays, weeklyWorkHours,
    // v3.5 신규 필드
    siteAddress, attendanceVerificationMethod, workUnitRule, rainDayRule,
    // v3.6 신규 필드
    companyName, companyPhone, workDate,
    workerBankName, workerAccountNumber, workerAccountHolder,
    companyBizNo, companyAddress, companyRepName,
    // 상용직 전용
    probationYn, probationMonths, annualLeaveRule,
  } = body

  if (!workerId || !startDate || !contractKind || !contractTemplateType) {
    return NextResponse.json({ error: 'workerId, startDate, contractKind, contractTemplateType 필수' }, { status: 400 })
  }

  // 차단 규칙: 사업자 없는 팀이 직접 관리 구조이면 외주 계약 금지
  if (contractTemplateType === 'NONBUSINESS_TEAM_REVIEW') {
    if (attendanceControlledByCompany || payDecidedByCompany || directPaymentByCompany) {
      return NextResponse.json({
        error: '회사가 출퇴근/급여/지급을 직접 관리하는 경우 팀장형 계약을 사용할 수 없습니다. 직접고용(일용직 근로계약서)으로 처리하세요.',
      }, { status: 400 })
    }
  }
  if (contractTemplateType === 'SUBCONTRACT_WITH_BIZ' && !businessRegistrationNo?.trim()) {
    return NextResponse.json({ error: '사업자 있는 외주팀은 사업자등록번호 필수' }, { status: 400 })
  }
  if (contractKind === 'EMPLOYMENT' && !dailyWage && !monthlySalary) {
    return NextResponse.json({ error: '근로계약에는 일당 또는 월급 필수' }, { status: 400 })
  }
  // 상용직 추가 validation
  const REGULAR_TYPES = ['REGULAR_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT', 'CONTINUOUS_EMPLOYMENT']
  if (REGULAR_TYPES.includes(contractTemplateType)) {
    if (!monthlySalary) {
      return NextResponse.json({ error: '상용직 근로계약에는 기본급(월급) 필수' }, { status: 400 })
    }
    if (contractTemplateType === 'FIXED_TERM_EMPLOYMENT' && !endDate) {
      return NextResponse.json({ error: '기간제 근로계약에는 계약 종료일 필수' }, { status: 400 })
    }
  }

  const legacyType = contractKind === 'EMPLOYMENT'
    ? (contractTemplateType === 'REGULAR_EMPLOYMENT' || contractTemplateType === 'FIXED_TERM_EMPLOYMENT' ? 'EMPLOYMENT' : 'DAILY')
    : 'SERVICE'

  // 자동 검토 플래그 계산
  const computedReviewFlags = reviewFlags
    || (contractTemplateType === 'NONBUSINESS_TEAM_REVIEW' ? 'NO_BUSINESS_REGISTRATION,REVIEW_REQUIRED' : null)

  const contract = await prisma.workerContract.create({
    data: {
      workerId,
      siteId:               siteId               || null,
      contractType:         legacyType            as never,
      contractKind:         contractKind          as never,
      contractTemplateType: contractTemplateType  as never,
      contractStatus:       'DRAFT'               as never,
      startDate,
      endDate:              endDate               || null,
      dailyWage:            dailyWage             || 0,
      monthlySalary:        monthlySalary         || null,
      serviceFee:           serviceFee            || null,
      paymentDay:           paymentDay            || null,
      standardWorkHours:    standardWorkHours     || null,
      breakHours:           breakHours            || null,
      nationalPensionYn:    nationalPensionYn     ?? false,
      healthInsuranceYn:    healthInsuranceYn     ?? false,
      employmentInsuranceYn: employmentInsuranceYn ?? false,
      industrialAccidentYn: industrialAccidentYn  ?? true,
      retirementMutualYn:   retirementMutualYn    ?? false,
      specialTerms:         specialTerms          || null,
      notes:                notes                 || null,
      createdBy:            session.sub,
      // v3.1
      laborRelationType:    laborRelationType      || null,
      businessRegistrationNo: businessRegistrationNo || null,
      contractorName:       contractorName         || null,
      safetyClauseYn:       safetyClauseYn         ?? true,
      checkInTime:          checkInTime            || null,
      checkOutTime:         checkOutTime           || null,
      workDays:             workDays               || null,
      paymentMethod:        paymentMethod          || null,
      reviewFlags:          computedReviewFlags,
      attendanceControlledByCompany: attendanceControlledByCompany ?? null,
      payDecidedByCompany:  payDecidedByCompany    ?? null,
      directPaymentByCompany: directPaymentByCompany ?? null,
      // v3.4
      projectName:          projectName            || null,
      workType:             workType               || null,
      workTypeSub:          workTypeSub            || null,
      jobCategory:          jobCategory            || null,
      jobCategorySub:       jobCategorySub         || null,
      contractForm:         contractForm           || null,
      taskDescription:      taskDescription        || null,
      breakStartTime:       breakStartTime         || null,
      breakEndTime:         breakEndTime           || null,
      weeklyWorkDays:       weeklyWorkDays         || null,
      weeklyWorkHours:      weeklyWorkHours        || null,
      // v3.5
      siteAddress:          siteAddress            || null,
      attendanceVerificationMethod: attendanceVerificationMethod || null,
      workUnitRule:         workUnitRule           || null,
      rainDayRule:          rainDayRule            || null,
      // v3.6
      companyName:          companyName            || null,
      companyPhone:         companyPhone           || null,
      companyBizNo:         companyBizNo           || null,
      companyAddress:       companyAddress         || null,
      companyRepName:       companyRepName         || null,
      workDate:             workDate               || null,
      workerBankName:       workerBankName         || null,
      workerAccountNumber:  workerAccountNumber    || null,
      workerAccountHolder:  workerAccountHolder    || null,
      // 상용직 전용
      probationYn:          probationYn            ?? false,
      probationMonths:      probationMonths        || null,
      annualLeaveRule:      annualLeaveRule         || null,
    } as never,
    include: {
      worker: { select: { id: true, name: true } },
      site:   { select: { id: true, name: true } },
    },
  })

  await writeAdminAuditLog({
    adminId: session.sub, actionType: 'CONTRACT_CREATE',
    targetType: 'WorkerContract', targetId: contract.id,
    description: `계약 생성: ${contract.worker.name} / ${contractKind} / ${contractTemplateType}`,
  })

  return NextResponse.json({ success: true, data: contract }, { status: 201 })
}
