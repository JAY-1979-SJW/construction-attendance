import { NextRequest } from 'next/server'
import { getAdminSession, requireRole, MUTATE_ROLES } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, badRequest, unauthorized, notFound, internalError } from '@/lib/utils/response'
import { generateQrToken } from '@/lib/qr/qr-token'
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

    const job = await prisma.bulkSiteImportJob.findUnique({ where: { id: jobId } })
    if (!job) return notFound('작업을 찾을 수 없습니다.')

    const approvedRows = await prisma.bulkSiteImportRow.findMany({
      where: { jobId, validationStatus: 'APPROVED' },
    })

    if (approvedRows.length === 0) return badRequest('승인된 행이 없습니다.')

    let importedCount = 0
    const errors: string[] = []

    for (const row of approvedRows) {
      // 필수 좌표 검증
      if (row.latitude == null || row.longitude == null) {
        errors.push(`행 ${row.rowNumber}: 좌표가 없습니다.`)
        continue
      }

      try {
        const site = await prisma.site.create({
          data: {
            name: row.siteName,
            address: row.normalizedAddress ?? row.rawAddress,
            latitude: row.latitude,
            longitude: row.longitude,
            allowedRadius: row.allowedRadiusMeters ?? 100,
            qrToken: generateQrToken(),
            isActive: true,
          },
        })

        await prisma.bulkSiteImportRow.update({
          where: { id: row.id },
          data: { validationStatus: 'IMPORTED', importedSiteId: site.id },
        })

        importedCount++
      } catch (err) {
        console.error(`[site-import] row ${row.rowNumber} failed`, err)
        errors.push(`행 ${row.rowNumber} (${row.siteName}): 등록 실패`)
      }
    }

    // Job 집계 재계산
    const counts = await prisma.bulkSiteImportRow.groupBy({
      by: ['validationStatus'],
      where: { jobId },
      _count: { _all: true },
    })
    const cm: Record<string, number> = {}
    for (const c of counts) cm[c.validationStatus] = c._count._all

    await prisma.bulkSiteImportJob.update({
      where: { id: jobId },
      data: {
        readyRows:    cm['READY'] ?? 0,
        failedRows:   (cm['FAILED'] ?? 0) + (cm['NEEDS_REVIEW'] ?? 0),
        approvedRows: cm['APPROVED'] ?? 0,
        importedRows: cm['IMPORTED'] ?? 0,
      },
    })

    await writeAuditLog({
      actorUserId: session.sub,
      actorType: 'ADMIN',
      actionType: 'SITE_IMPORT_EXECUTE',
      targetType: 'BulkSiteImportJob',
      targetId: jobId,
      summary: `현장 일괄 등록: ${importedCount}건 완료 (파일: ${job.originalFilename})`,
      metadataJson: { jobId, importedCount, errors },
    })

    if (errors.length > 0) {
      return ok({ importedCount, errors }, `${importedCount}개 현장 등록 완료. 오류: ${errors.length}건`)
    }
    return ok({ importedCount, errors: [] }, `${importedCount}개 현장이 등록되었습니다.`)
  } catch (err) {
    console.error('[site-imports import POST]', err)
    return internalError()
  }
}
