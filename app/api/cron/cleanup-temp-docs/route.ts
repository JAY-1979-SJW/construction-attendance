/**
 * GET /api/cron/cleanup-temp-docs
 * 임시 민감 서류 자동 삭제 스케줄러
 * - 5일 초과 서류: 자동 삭제
 * - 다운로드 후 24h 경과 서류: 자동 삭제
 *
 * crontab: 0 * * * * (매 시 정각 실행) 또는 매15분 간격 설정 가능
 * Authorization: Bearer {CRON_SECRET}
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { unlink } from 'fs/promises'
import { TEMP_DOC_DELETE_REASON, TEMP_DOC_EVENT_REASON } from '@/lib/policies/temp-doc-policy'

export async function GET(req: NextRequest) {
  // cron 인증
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  let deleted = 0
  let errors  = 0

  try {
    // 1. 만료 서류 (5일 초과)
    const expired = await prisma.tempSensitiveDocument.findMany({
      where: {
        deletedAt: null,
        expiresAt: { lte: now },
      },
    })

    // 2. 다운로드 후 24h 경과 서류
    const postDownload = await prisma.tempSensitiveDocument.findMany({
      where: {
        deletedAt: null,
        expiresAt: { gt: now },              // 아직 만료 전이지만
        deleteScheduledAt: { lte: now },     // 다운로드 후 24h 경과
      },
    })

    const targets = [...expired, ...postDownload]

    for (const doc of targets) {
      try {
        // 파일 삭제
        try {
          await unlink(doc.filePath)
        } catch {
          // 파일 없어도 DB 처리 계속
        }

        const isExpired = expired.includes(doc)
        await prisma.tempSensitiveDocument.update({
          where: { id: doc.id },
          data: {
            deletedAt: now,
            deleteReason: isExpired ? TEMP_DOC_DELETE_REASON.EXPIRED : TEMP_DOC_DELETE_REASON.POST_DOWNLOAD,
          },
        })

        await prisma.tempSensitiveDocumentEvent.create({
          data: {
            documentId: doc.id,
            eventType:  'AUTO_DELETED',
            actorType:  'SYSTEM',
            reason:     isExpired ? TEMP_DOC_EVENT_REASON.EXPIRED : TEMP_DOC_EVENT_REASON.POST_DOWNLOAD,
            metadataJson: { triggeredAt: now.toISOString(), workerId: doc.workerId },
          },
        })

        deleted++
      } catch (e) {
        console.error(`[cron/cleanup-temp-docs] doc ${doc.id} 삭제 실패:`, e)
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      deleted,
      errors,
      checkedAt: now.toISOString(),
    })
  } catch (err) {
    console.error('[cron/cleanup-temp-docs]', err)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
