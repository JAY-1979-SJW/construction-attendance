/**
 * POST /api/admin/worker-imports/[jobId]/import
 * APPROVED + REGISTER_NEW 건을 실제 근로자로 등록
 */
import { NextRequest } from 'next/server'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const deny = requireRole(session, MUTATE_ROLES)
    if (deny) return deny

    const { jobId } = await params

    const job = await prisma.bulkWorkerImportJob.findUnique({ where: { id: jobId } })
    if (!job) return notFound('작업을 찾을 수 없습니다.')

    // APPROVED + REGISTER_NEW + importedWorkerId 없음 → 실제 등록 대상
    const approvedRows = await prisma.bulkWorkerImportRow.findMany({
      where: {
        jobId,
        validationStatus: 'APPROVED',
        userDecision: 'REGISTER_NEW',
        importedWorkerId: null,
      },
    })

    if (approvedRows.length === 0) return badRequest('등록 대상 행이 없습니다.')

    let importedCount = 0
    const errors: string[] = []

    for (const row of approvedRows) {
      try {
        const worker = await prisma.worker.create({
          data: {
            name: row.name,
            phone: row.normalizedPhone ?? row.phone,
            jobTitle: row.jobTitle,
            employmentType: (row.employmentType ?? 'DAILY_CONSTRUCTION') as never,
            organizationType: (row.organizationType ?? 'DIRECT') as never,
            foreignerYn: row.foreignerYn,
            nationalityCode: row.foreignerYn ? null : 'KR',
            skillLevel: row.skillLevel,
            birthDate: row.birthDate ?? undefined,
            subcontractorName: row.organizationType === 'SUBCONTRACTOR' ? row.subcontractorName : null,
          },
        })

        await prisma.bulkWorkerImportRow.update({
          where: { id: row.id },
          data: {
            validationStatus: 'IMPORTED',
            importedWorkerId: worker.id,
            validationMessage: '등록 완료',
          },
        })

        importedCount++
      } catch (err) {
        console.error(`[worker-import] row ${row.rowNumber} failed`, err)
        errors.push(`행 ${row.rowNumber} (${row.name}): 등록 실패`)
      }
    }

    // 집계 재계산
    const statusCounts = await prisma.bulkWorkerImportRow.groupBy({
      by: ['validationStatus'],
      where: { jobId },
      _count: { _all: true },
    })
    const sm: Record<string, number> = {}
    for (const c of statusCounts) sm[c.validationStatus] = c._count._all

    await prisma.bulkWorkerImportJob.update({
      where: { id: jobId },
      data: {
        failedRows: sm['FAILED'] ?? 0,
        importedRows: sm['IMPORTED'] ?? 0,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actorRole: session.role,
      actionType: 'WORKER_IMPORT_EXECUTE',
      targetType: 'BulkWorkerImportJob',
      targetId: jobId,
      summary: `근로자 일괄 등록: ${importedCount}건 완료 (파일: ${job.originalFilename})`,
      metadataJson: { jobId, importedCount, errors },
    })

    if (errors.length > 0) {
      return ok({ importedCount, errors }, `${importedCount}명 등록 완료. 오류: ${errors.length}건`)
    }
    return ok({ importedCount, errors: [] }, `${importedCount}명이 등록되었습니다.`)
  } catch (err) {
    console.error('[worker-imports import POST]', err)
    return internalError()
  }
}
