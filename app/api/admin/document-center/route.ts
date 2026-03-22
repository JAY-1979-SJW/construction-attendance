import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { createExcelDocument, ExcelDocumentType } from '@/lib/labor/excel-export'

const VALID_DOC_TYPES: ExcelDocumentType[] = [
  'WAGE_LEDGER', 'MONTHLY_ATTENDANCE', 'INSURANCE_REPORT',
  'TAX_REPORT', 'RETIREMENT_MUTUAL_SUMMARY', 'SUBCONTRACTOR_SETTLEMENT',
]

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { monthKey, documentType, siteId, companyId, subcontractorId } = body

  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    return NextResponse.json({ error: 'INVALID_MONTH_KEY' }, { status: 400 })
  }
  if (!VALID_DOC_TYPES.includes(documentType)) {
    return NextResponse.json({ error: 'INVALID_DOC_TYPE' }, { status: 400 })
  }

  try {
    const result = await createExcelDocument({
      monthKey,
      documentType: documentType as ExcelDocumentType,
      siteId,
      companyId: companyId ?? subcontractorId,
      createdBy: session.sub,
    })

    // Return as downloadable file
    return new NextResponse(result.buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
        'X-Row-Count': String(result.rowCount),
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '생성 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
