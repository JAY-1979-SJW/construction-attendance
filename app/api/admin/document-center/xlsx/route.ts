import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { createXlsxDocument, XlsxDocumentType } from '@/lib/labor/document-export-xlsx-service'
import { prisma } from '@/lib/db/prisma'

const XLSX_SUPPORTED: XlsxDocumentType[] = [
  'WAGE_LEDGER', 'INSURANCE_REPORT', 'TAX_REPORT',
  'RETIREMENT_MUTUAL_SUMMARY', 'SUBCONTRACTOR_SETTLEMENT',
]

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { monthKey, documentType, siteId, subcontractorId } = body

  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    return NextResponse.json({ error: 'INVALID_MONTH_KEY' }, { status: 400 })
  }
  if (!XLSX_SUPPORTED.includes(documentType)) {
    return NextResponse.json({ error: `XLSX_NOT_SUPPORTED for ${documentType}` }, { status: 400 })
  }

  try {
    const { buffer, fileName } = await createXlsxDocument({
      monthKey,
      documentType: documentType as XlsxDocumentType,
      siteId,
      subcontractorId,
    })

    // 다운로드 이력 기록
    await prisma.filingExport.create({
      data: {
        monthKey,
        exportType: 'LABOR_COST_SUMMARY' as never, // 범용 타입 사용
        status: 'COMPLETED',
        fileFormat: 'XLSX',
        templateCode: documentType,
        siteId: siteId ?? null,
        yearMonth: monthKey,
        createdBy: session.sub,
        lastDownloadedBy: session.sub,
        lastDownloadedAt: new Date(),
        downloadCount: 1,
        rowCount: 0,
      },
    }).catch(() => { /* 이력 저장 실패해도 다운로드는 계속 */ })

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '생성 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
