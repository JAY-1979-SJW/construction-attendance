import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getAdminSession } from '@/lib/auth/guards'
import { writeAdminAuditLog } from '@/lib/audit/write-audit-log'

// GET /api/admin/contracts/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const contract = await prisma.workerContract.findUnique({
    where: { id: params.id },
    include: {
      worker:            { select: { id: true, name: true, phone: true, jobTitle: true } },
      site:              { select: { id: true, name: true } },
      generatedDocuments: { orderBy: { generatedAt: 'desc' }, take: 10 },
    },
  })
  if (!contract) return NextResponse.json({ error: '계약 없음' }, { status: 404 })

  return NextResponse.json({ success: true, data: contract })
}

// PATCH /api/admin/contracts/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const existing = await prisma.workerContract.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: '계약 없음' }, { status: 404 })

  if (existing.contractStatus === 'ENDED') {
    return NextResponse.json({ error: '종료된 계약은 수정할 수 없습니다.' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const {
    endDate, dailyWage, monthlySalary, serviceFee,
    paymentDay, standardWorkHours, breakHours,
    nationalPensionYn, healthInsuranceYn,
    employmentInsuranceYn, industrialAccidentYn, retirementMutualYn,
    specialTerms, notes, signedAt,
    // 레거시 필드
    hourlyRate, overtimeRate, nightRate, holidayRate,
    halfDayRule, taxRuleType, insuranceRuleType, retirementMutualRuleType,
  } = body

  const updated = await prisma.workerContract.update({
    where: { id: params.id },
    data: {
      ...(endDate                  != null && { endDate }),
      ...(dailyWage                != null && { dailyWage }),
      ...(monthlySalary            != null && { monthlySalary }),
      ...(serviceFee               != null && { serviceFee }),
      ...(paymentDay               != null && { paymentDay }),
      ...(standardWorkHours        != null && { standardWorkHours }),
      ...(breakHours               != null && { breakHours }),
      ...(nationalPensionYn        != null && { nationalPensionYn }),
      ...(healthInsuranceYn        != null && { healthInsuranceYn }),
      ...(employmentInsuranceYn    != null && { employmentInsuranceYn }),
      ...(industrialAccidentYn     != null && { industrialAccidentYn }),
      ...(retirementMutualYn       != null && { retirementMutualYn }),
      ...(specialTerms             != null && { specialTerms }),
      ...(notes                    != null && { notes }),
      ...(signedAt                 != null && { signedAt: new Date(signedAt) }),
      // 레거시
      ...(hourlyRate               != null && { hourlyRate }),
      ...(overtimeRate             != null && { overtimeRate }),
      ...(nightRate                != null && { nightRate }),
      ...(holidayRate              != null && { holidayRate }),
      ...(halfDayRule              != null && { halfDayRule }),
      ...(taxRuleType              != null && { taxRuleType }),
      ...(insuranceRuleType        != null && { insuranceRuleType }),
      ...(retirementMutualRuleType != null && { retirementMutualRuleType }),
    },
  })

  await writeAdminAuditLog({
    adminId: session.sub, actionType: 'CONTRACT_UPDATE',
    targetType: 'WorkerContract', targetId: params.id,
    description: '계약 수정',
  })

  return NextResponse.json({ success: true, data: updated })
}
